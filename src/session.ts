import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { mkdir, mkdtemp, rm } from "node:fs/promises";

import { decryptProfile, parseEnvelopeText } from "./crypto.js";
import { writeCodexWrapper, resolveExecutable } from "./codex.js";
import {
  formatProfileReference,
  parseProfileReference,
  type ProfileReference,
} from "./reference.js";
import type { CodexProfile } from "./profile.js";

const PASSPHRASE_ENV = "MY_CODEX_PASSPHRASE";

export interface LoadedProfile {
  reference: ProfileReference;
  profile: CodexProfile;
}

export interface PreparedEnvironment {
  cleanup(): Promise<void>;
  env: NodeJS.ProcessEnv;
  tempRoot: string;
}

export interface RuntimeReport {
  codexPath: string | null;
  nodeVersion: string;
  passphraseEnv: string;
  shell: string | null;
}

interface MutedReadline extends readline.Interface {
  _writeToOutput(text: string): void;
  output: NodeJS.WritableStream;
  stdoutMuted?: boolean;
}

async function readHiddenInput(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error(
      `Passphrase is required but no TTY is available. Set ${PASSPHRASE_ENV} instead.`,
    );
  }

  return await new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

    const mutableRl = rl as MutedReadline;
    mutableRl.stdoutMuted = true;
    mutableRl._writeToOutput = (text) => {
      if (mutableRl.stdoutMuted) {
        mutableRl.output.write("*".repeat(text.length));
        return;
      }

      mutableRl.output.write(text);
    };

    rl.question(prompt, (answer) => {
      rl.close();
      process.stderr.write("\n");
      resolve(answer);
    });
  });
}

export async function resolvePassphrase(confirm = false): Promise<string> {
  const fromEnv = process.env[PASSPHRASE_ENV];
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv;
  }

  const passphrase = await readHiddenInput("Passphrase: ");
  if (passphrase.length === 0) {
    throw new Error("Passphrase cannot be empty.");
  }

  if (!confirm) {
    return passphrase;
  }

  const repeated = await readHiddenInput("Confirm passphrase: ");
  if (passphrase !== repeated) {
    throw new Error("Passphrases do not match.");
  }

  return passphrase;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "my-codex",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download profile: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

export async function loadProfile(referenceInput: string): Promise<LoadedProfile> {
  const reference = parseProfileReference(referenceInput);
  const encryptedText = await fetchText(reference.rawUrl);
  const envelope = parseEnvelopeText(encryptedText);
  const passphrase = await resolvePassphrase(false);
  const profile = decryptProfile(envelope, passphrase);

  return {
    reference,
    profile,
  };
}

function withPrependedPath(binDir: string, currentPath: string | undefined): string {
  return currentPath && currentPath.length > 0
    ? `${binDir}${path.delimiter}${currentPath}`
    : binDir;
}

export async function prepareEnvironment(profile: CodexProfile): Promise<PreparedEnvironment> {
  const codexPath = resolveExecutable("codex");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "my-codex-"));
  const binDir = path.join(tempRoot, "bin");
  await mkdir(binDir, { recursive: true });
  await writeCodexWrapper(binDir, codexPath, profile);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...profile.env,
    PATH: withPrependedPath(binDir, process.env.PATH),
    MY_CODEX_ACTIVE: "1",
    MY_CODEX_MODE: profile.mode,
    MY_CODEX_PROFILE: profile.name,
  };

  if (profile.mode === "isolated") {
    const codexHome = path.join(tempRoot, "codex-home");
    await mkdir(codexHome, { recursive: true });
    env.CODEX_HOME = codexHome;
  }

  return {
    env,
    tempRoot,
    async cleanup() {
      await rm(tempRoot, { recursive: true, force: true });
    },
  };
}

async function runChild(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Process exited with signal ${signal}.`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

export async function useProfile(referenceInput: string): Promise<number> {
  const { reference, profile } = await loadProfile(referenceInput);
  const prepared = await prepareEnvironment(profile);
  const shell = process.env.SHELL ?? "/bin/sh";

  process.stderr.write(
    `Activated ${formatProfileReference(reference)} in ${profile.mode} mode. Exit the shell to leave.\n`,
  );

  try {
    return await runChild(shell, [], prepared.env);
  } finally {
    await prepared.cleanup();
  }
}

export async function execWithProfile(
  referenceInput: string,
  commandWithArgs: string[],
): Promise<number> {
  const { profile } = await loadProfile(referenceInput);
  const prepared = await prepareEnvironment(profile);
  const [command, ...args] = commandWithArgs.length > 0 ? commandWithArgs : ["codex"];

  try {
    return await runChild(command, args, prepared.env);
  } finally {
    await prepared.cleanup();
  }
}

export function inspectRuntime(): RuntimeReport {
  let codexPath: string | null = null;
  try {
    codexPath = resolveExecutable("codex");
  } catch {
    codexPath = null;
  }

  return {
    codexPath,
    nodeVersion: process.version,
    passphraseEnv: PASSPHRASE_ENV,
    shell: process.env.SHELL ?? null,
  };
}

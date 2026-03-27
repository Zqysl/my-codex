import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { mkdir, mkdtemp, rm } from "node:fs/promises";

import { decryptProfile } from "./crypto.js";
import { writeCodexWrapper, resolveExecutable } from "./codex.js";
import { formatProfileSummary, formatRemoteProfilePreview } from "./preview.js";
import {
  formatProfileReference,
  parseProfileReference,
  type ProfileReference,
} from "./reference.js";
import type { CodexProfile } from "./profile.js";

const PASSPHRASE_ENV = "MY_CODEX_PASSPHRASE";
const ASSUME_YES_ENV = "MY_CODEX_ASSUME_YES";

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
  assumeYesEnv: string;
}

function requireCodexForUse(): string {
  try {
    return resolveExecutable("codex");
  } catch {
    throw new Error(
      'Codex CLI is not available on PATH. Install `codex` first before running `my-codex use`.',
    );
  }
}

interface MutedReadline extends readline.Interface {
  _writeToOutput(text: string): void;
  output: NodeJS.WritableStream;
  stdoutMuted?: boolean;
}

export function maskHiddenInputOutput(prompt: string, text: string): string {
  if (text === prompt) {
    return text;
  }

  return "*".repeat(text.length);
}

export function isAffirmativeResponse(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}

export function shouldAssumeYes(value: string | undefined): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "y";
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
        mutableRl.output.write(maskHiddenInputOutput(prompt, text));
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

async function readVisibleInput(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error(
      `Confirmation required but no TTY is available. Re-run with --yes or set ${ASSUME_YES_ENV}=1.`,
    );
  }

  return await new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

interface ResolvePassphraseOptions {
  confirm?: boolean;
  prompt?: string;
  confirmPrompt?: string;
}

export async function resolvePassphrase(options: ResolvePassphraseOptions = {}): Promise<string> {
  const prompt = options.prompt ?? "Passphrase: ";
  const confirm = options.confirm ?? false;
  const confirmPrompt = options.confirmPrompt ?? "Confirm passphrase: ";
  const fromEnv = process.env[PASSPHRASE_ENV];
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv;
  }

  const passphrase = await readHiddenInput(prompt);
  if (passphrase.length === 0) {
    throw new Error("Passphrase cannot be empty.");
  }

  if (!confirm) {
    return passphrase;
  }

  const repeated = await readHiddenInput(confirmPrompt);
  if (passphrase !== repeated) {
    throw new Error("Passphrases do not match.");
  }

  return passphrase;
}

interface ConfirmActionOptions {
  assumeYes?: boolean;
}

export async function confirmAction(
  prompt: string,
  options: ConfirmActionOptions = {},
): Promise<void> {
  if (options.assumeYes || shouldAssumeYes(process.env[ASSUME_YES_ENV])) {
    return;
  }

  const answer = await readVisibleInput(prompt);
  if (!isAffirmativeResponse(answer)) {
    throw new Error("Aborted.");
  }
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

interface LoadProfileOptions {
  assumeYes?: boolean;
}

export async function loadProfile(
  referenceInput: string,
  options: LoadProfileOptions = {},
): Promise<LoadedProfile> {
  const reference = parseProfileReference(referenceInput);
  const encryptedText = await fetchText(reference.rawUrl);
  process.stderr.write(`${formatRemoteProfilePreview(reference, encryptedText)}\n`);
  await confirmAction("Continue and decrypt this profile? [y/N] ", {
    assumeYes: options.assumeYes,
  });
  const passphrase = await resolvePassphrase({
    prompt: `Passphrase for ${formatProfileReference(reference)}: `,
  });
  const profile = await decryptProfile(encryptedText, passphrase);
  process.stderr.write(
    `${formatProfileSummary(profile, "Decrypted configuration preview:")}\n`,
  );
  await confirmAction("Continue and activate this configuration? [y/N] ", {
    assumeYes: options.assumeYes,
  });

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

export async function prepareEnvironment(
  profile: CodexProfile,
  codexPath = resolveExecutable("codex"),
): Promise<PreparedEnvironment> {
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

interface ActivationOptions {
  assumeYes?: boolean;
}

export async function useProfile(
  referenceInput: string,
  options: ActivationOptions = {},
): Promise<number> {
  const codexPath = requireCodexForUse();
  const { reference, profile } = await loadProfile(referenceInput, options);
  const prepared = await prepareEnvironment(profile, codexPath);

  process.stderr.write(
    `Launching codex for ${formatProfileReference(reference)} in ${profile.mode} mode.\n`,
  );

  try {
    return await runChild("codex", [], prepared.env);
  } finally {
    await prepared.cleanup();
  }
}

export async function execWithProfile(
  referenceInput: string,
  commandWithArgs: string[],
  options: ActivationOptions = {},
): Promise<number> {
  const { profile } = await loadProfile(referenceInput, options);
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
    assumeYesEnv: ASSUME_YES_ENV,
  };
}

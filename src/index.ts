#!/usr/bin/env node
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { Command } from "commander";

import { encryptProfile } from "./crypto.js";
import { getDefaultCodexHome, importCodexProfile } from "./import-codex.js";
import { formatProfileSummary } from "./preview.js";
import {
  confirmAction,
  execWithProfile,
  inspectRuntime,
  resolvePassphrase,
  useProfile,
} from "./session.js";

const program = new Command();

program
  .name("my-codex")
  .description("Session-scoped Codex profile activator for GitHub-hosted encrypted profiles.")
  .version("0.1.0");

program
  .command("use")
  .argument("<reference>", "profile reference: <owner> or <owner>/<profile>")
  .option("--yes", "skip interactive confirmation prompts")
  .description("Launch Codex directly with a remote encrypted profile.")
  .action(async (reference: string, options: { yes?: boolean }) => {
    const code = await useProfile(reference, {
      assumeYes: options.yes,
    });
    process.exitCode = code;
  });

program
  .command("exec")
  .argument("<reference>", "profile reference: <owner> or <owner>/<profile>")
  .argument("[command...]", "command to execute inside the activated environment")
  .option("--yes", "skip interactive confirmation prompts")
  .description("Run a single command with a remote encrypted profile activated.")
  .action(async (reference: string, command: string[], options: { yes?: boolean }) => {
    const code = await execWithProfile(reference, command, {
      assumeYes: options.yes,
    });
    process.exitCode = code;
  });

program
  .command("encrypt")
  .argument("[output]", "output encrypted profile path")
  .option("--codex-home <path>", "Codex home to import from", getDefaultCodexHome())
  .option("--name <name>", "profile name", "default")
  .option("--mode <mode>", "profile mode: shared or isolated", "shared")
  .option("--yes", "skip interactive confirmation prompts")
  .description("Read auth.json and config.toml from Codex home, then encrypt them into an age file.")
  .action(async (output: string | undefined, options: {
    codexHome: string;
    mode: "shared" | "isolated";
    name: string;
    yes?: boolean;
  }) => {
    const profile = await importCodexProfile({
      codexHome: options.codexHome,
      mode: options.mode,
      name: options.name,
    });
    process.stderr.write(
      `${formatProfileSummary(profile, `Imported configuration preview from ${options.codexHome}:`)}\n`,
    );
    await confirmAction("Continue and encrypt this configuration? [y/N] ", {
      assumeYes: options.yes,
    });
    const passphrase = await resolvePassphrase({
      confirm: true,
      prompt: `Passphrase to encrypt ${profile.name}: `,
      confirmPrompt: `Confirm passphrase for ${profile.name}: `,
    });
    const encrypted = await encryptProfile(profile, passphrase);
    const defaultOutput = path.join(process.cwd(), "profiles", `${profile.name}.age`);
    const targetPath = output ?? defaultOutput;
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, encrypted, "utf8");
    process.stderr.write(`Imported ${options.codexHome} -> ${targetPath}\n`);
  });

program
  .command("doctor")
  .description("Show local runtime details that affect my-codex activation.")
  .action(() => {
    process.stdout.write(`${JSON.stringify(inspectRuntime(), null, 2)}\n`);
  });

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`my-codex: ${reason}\n`);
  process.exit(1);
});

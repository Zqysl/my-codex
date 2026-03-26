#!/usr/bin/env node
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import { Command } from "commander";

import {
  encryptProfile,
  serializeEnvelope,
} from "./crypto.js";
import { parseProfileText } from "./profile.js";
import {
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
  .description("Open a temporary shell with Codex configured from a remote encrypted profile.")
  .action(async (reference: string) => {
    const code = await useProfile(reference);
    process.exitCode = code;
  });

program
  .command("exec")
  .argument("<reference>", "profile reference: <owner> or <owner>/<profile>")
  .argument("[command...]", "command to execute inside the activated environment")
  .description("Run a single command with a remote encrypted profile activated.")
  .action(async (reference: string, command: string[]) => {
    const code = await execWithProfile(reference, command);
    process.exitCode = code;
  });

program
  .command("encrypt")
  .argument("<input>", "path to a plaintext profile JSON file")
  .argument("[output]", "output encrypted profile path")
  .description("Encrypt a plaintext profile into a GitHub-safe .mcx.json envelope.")
  .action(async (input: string, output?: string) => {
    const plaintext = await readFile(input, "utf8");
    const profile = parseProfileText(plaintext);
    const passphrase = await resolvePassphrase(true);
    const envelope = encryptProfile(profile, passphrase);
    const defaultOutput = path.join(
      path.dirname(input),
      `${path.basename(input, path.extname(input))}.mcx.json`,
    );
    await writeFile(output ?? defaultOutput, serializeEnvelope(envelope), "utf8");
    process.stderr.write(`Wrote ${output ?? defaultOutput}\n`);
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

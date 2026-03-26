import { chmodSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { CodexProfile, JsonValue } from "./profile.js";

export interface CodexOverride {
  key: string;
  value: JsonValue;
}

function isExecutableMode(mode: number): boolean {
  return (mode & 0o111) !== 0;
}

export function resolveExecutable(command: string, pathValue = process.env.PATH ?? ""): string {
  for (const entry of pathValue.split(path.delimiter)) {
    if (entry.length === 0) {
      continue;
    }

    const candidate = path.join(entry, command);
    try {
      const stats = statSync(candidate);
      if (stats.isFile() && isExecutableMode(stats.mode)) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  throw new Error(`Could not find "${command}" on PATH.`);
}

export function buildCodexOverrides(profile: CodexProfile): CodexOverride[] {
  const overrides: CodexOverride[] = Object.entries(profile.overrides).map(
    ([key, value]) => ({
      key,
      value,
    }),
  );

  for (const [providerId, provider] of Object.entries(profile.providers)) {
    overrides.push({
      key: `model_providers.${providerId}.name`,
      value: provider.name ?? providerId,
    });
    overrides.push({
      key: `model_providers.${providerId}.base_url`,
      value: provider.baseUrl,
    });
    overrides.push({
      key: `model_providers.${providerId}.wire_api`,
      value: provider.wireApi,
    });
  }

  return overrides;
}

export function buildCodexArgs(profile: CodexProfile): string[] {
  return buildCodexOverrides(profile).flatMap((override) => [
    "-c",
    `${override.key}=${JSON.stringify(override.value)}`,
  ]);
}

export async function writeCodexWrapper(
  directory: string,
  codexPath: string,
  profile: CodexProfile,
): Promise<string> {
  const wrapperPath = path.join(directory, "codex");
  const args = buildCodexArgs(profile);
  const content = `#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const codexPath = ${JSON.stringify(codexPath)};
const args = ${JSON.stringify(args)};
const result = spawnSync(codexPath, [...args, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
`;

  await writeFile(wrapperPath, content, "utf8");
  chmodSync(wrapperPath, 0o755);
  return wrapperPath;
}

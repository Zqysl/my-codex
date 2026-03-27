import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { TomlDate, parse as parseToml } from "smol-toml";

import type {
  CodexProfile,
  JsonObject,
  JsonValue,
  ProfileMode,
  ProfileProvider,
  WireApi,
} from "./profile.js";
import { parseProfile } from "./profile.js";

const DEFAULT_CODEX_HOME = path.join(os.homedir(), ".codex");

interface ImportOptions {
  codexHome?: string;
  mode?: ProfileMode;
  name?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWireApi(value: unknown): value is WireApi {
  return value === "responses" || value === "chat_completions";
}

function toJsonValue(value: unknown, label: string): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    const asNumber = Number(value);
    if (Number.isSafeInteger(asNumber)) {
      return asNumber;
    }

    return value.toString();
  }

  if (value instanceof Date || value instanceof TomlDate) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => toJsonValue(entry, `${label}[${index}]`));
  }

  if (isPlainObject(value)) {
    const object: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      object[key] = toJsonValue(entry, `${label}.${key}`);
    }

    return object;
  }

  throw new Error(`${label} is not JSON-serializable.`);
}

function normalizeOverrideValue(key: string, value: JsonValue): JsonValue {
  if (
    (key === "model_reasoning_effort" || key.endsWith(".model_reasoning_effort")) &&
    typeof value === "string"
  ) {
    const normalized = value.replace(/^x(minimal|low|medium|high)$/u, "$1");
    return normalized;
  }

  return value;
}

function flattenTomlValue(
  prefix: string,
  value: unknown,
  overrides: Record<string, JsonValue>,
): void {
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      overrides[prefix] = {};
      return;
    }

    for (const [key, entry] of entries) {
      flattenTomlValue(`${prefix}.${key}`, entry, overrides);
    }
    return;
  }

  overrides[prefix] = normalizeOverrideValue(prefix, toJsonValue(value, prefix));
}

function parseProviders(
  value: unknown,
  overrides: Record<string, JsonValue>,
): Record<string, ProfileProvider> {
  if (!isPlainObject(value)) {
    return {};
  }

  const providers: Record<string, ProfileProvider> = {};

  for (const [providerId, entry] of Object.entries(value)) {
    if (
      isPlainObject(entry) &&
      typeof entry.base_url === "string" &&
      isWireApi(entry.wire_api)
    ) {
      providers[providerId] = {
        name: typeof entry.name === "string" ? entry.name : providerId,
        baseUrl: entry.base_url,
        wireApi: entry.wire_api,
      };
      continue;
    }

    flattenTomlValue(`model_providers.${providerId}`, entry, overrides);
  }

  return providers;
}

function parseAuthJson(input: string): Record<string, string> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse auth.json: ${reason}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error("auth.json must contain an object.");
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value.length > 0) {
      env[key] = value;
    }
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error("auth.json does not contain OPENAI_API_KEY.");
  }

  return env;
}

function parseConfigToml(input: string): {
  overrides: Record<string, JsonValue>;
  providers: Record<string, ProfileProvider>;
} {
  const parsed = parseToml(input);

  if (!isPlainObject(parsed)) {
    throw new Error("config.toml must contain a TOML table.");
  }

  const overrides: Record<string, JsonValue> = {};
  const providers = parseProviders(parsed.model_providers, overrides);

  for (const [key, value] of Object.entries(parsed)) {
    if (key === "model_providers") {
      continue;
    }

    flattenTomlValue(key, value, overrides);
  }

  return {
    overrides,
    providers,
  };
}

export async function importCodexProfile(options: ImportOptions = {}): Promise<CodexProfile> {
  const codexHome = options.codexHome ?? DEFAULT_CODEX_HOME;
  const authPath = path.join(codexHome, "auth.json");
  const configPath = path.join(codexHome, "config.toml");
  const [authText, configText] = await Promise.all([
    readFile(authPath, "utf8"),
    readFile(configPath, "utf8"),
  ]);

  const env = parseAuthJson(authText);
  const { overrides, providers } = parseConfigToml(configText);

  return parseProfile({
    version: 1,
    name: options.name ?? "default",
    mode: options.mode ?? "shared",
    env,
    overrides,
    providers,
  });
}

export function getDefaultCodexHome(): string {
  return DEFAULT_CODEX_HOME;
}

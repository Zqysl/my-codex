export type ProfileMode = "shared" | "isolated";
export type WireApi = "responses" | "chat_completions";

export interface ProfileProvider {
  name?: string;
  baseUrl: string;
  wireApi: WireApi;
}

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface CodexProfile {
  version: 1;
  name: string;
  mode: ProfileMode;
  env: Record<string, string>;
  overrides: Record<string, JsonValue>;
  providers: Record<string, ProfileProvider>;
}

const DEFAULT_MODE: ProfileMode = "shared";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function assertWireApi(value: unknown, label: string): WireApi {
  if (value === "responses" || value === "chat_completions") {
    return value;
  }

  throw new Error(`${label} must be "responses" or "chat_completions".`);
}

function assertMode(value: unknown, label: string): ProfileMode {
  if (value === "shared" || value === "isolated") {
    return value;
  }

  throw new Error(`${label} must be "shared" or "isolated".`);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry));
  }

  if (isPlainObject(value)) {
    return Object.values(value).every((entry) => isJsonValue(entry));
  }

  return false;
}

function parseEnv(input: unknown): Record<string, string> {
  if (!isPlainObject(input)) {
    throw new Error("profile.env must be an object.");
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    env[key] = assertString(value, `profile.env.${key}`);
  }

  if (typeof env.OPENAI_API_KEY !== "string" || env.OPENAI_API_KEY.length === 0) {
    throw new Error("profile.env.OPENAI_API_KEY is required.");
  }

  return env;
}

function parseOverrides(input: unknown): Record<string, JsonValue> {
  if (input === undefined) {
    return {};
  }

  if (!isPlainObject(input)) {
    throw new Error("profile.overrides must be an object.");
  }

  const overrides: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isJsonValue(value)) {
      throw new Error(`profile.overrides.${key} must be JSON-serializable.`);
    }

    overrides[key] = value;
  }

  return overrides;
}

function parseProviders(input: unknown): Record<string, ProfileProvider> {
  if (input === undefined) {
    return {};
  }

  if (!isPlainObject(input)) {
    throw new Error("profile.providers must be an object.");
  }

  const providers: Record<string, ProfileProvider> = {};
  for (const [providerId, value] of Object.entries(input)) {
    if (!isPlainObject(value)) {
      throw new Error(`profile.providers.${providerId} must be an object.`);
    }

    providers[providerId] = {
      name: typeof value.name === "string" ? value.name : undefined,
      baseUrl: assertString(value.baseUrl, `profile.providers.${providerId}.baseUrl`),
      wireApi: assertWireApi(
        value.wireApi,
        `profile.providers.${providerId}.wireApi`,
      ),
    };
  }

  return providers;
}

export function parseProfile(input: unknown): CodexProfile {
  if (!isPlainObject(input)) {
    throw new Error("profile must be an object.");
  }

  const version = input.version ?? 1;
  if (version !== 1) {
    throw new Error(`Unsupported profile version: ${String(version)}.`);
  }

  return {
    version: 1,
    name: assertString(input.name, "profile.name"),
    mode: input.mode === undefined ? DEFAULT_MODE : assertMode(input.mode, "profile.mode"),
    env: parseEnv(input.env),
    overrides: parseOverrides(input.overrides),
    providers: parseProviders(input.providers),
  };
}

export function parseProfileText(input: string): CodexProfile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse profile JSON: ${reason}`);
  }

  return parseProfile(parsed);
}

export function serializeProfile(profile: CodexProfile): string {
  return JSON.stringify(profile, null, 2);
}

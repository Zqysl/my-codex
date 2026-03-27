import type { CodexProfile, JsonValue } from "./profile.js";
import { formatProfileReference, type ProfileReference } from "./reference.js";

function formatJsonValue(value: JsonValue): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function formatOverrides(profile: CodexProfile): string[] {
  return Object.entries(profile.overrides).map(
    ([key, value]) => `- ${key}: ${formatJsonValue(value)}`,
  );
}

function formatProviders(profile: CodexProfile): string[] {
  return Object.entries(profile.providers).map(
    ([providerId, provider]) =>
      `- ${providerId}: ${provider.baseUrl} (${provider.wireApi})`,
  );
}

export function formatRemoteProfilePreview(
  reference: ProfileReference,
  encryptedText: string,
): string {
  return [
    "Profile source:",
    `- reference: ${formatProfileReference(reference)}`,
    `- url: ${reference.rawUrl}`,
    `- encrypted size: ${Buffer.byteLength(encryptedText, "utf8")} bytes`,
  ].join("\n");
}

export function formatProfileSummary(profile: CodexProfile, heading = "Configuration preview:"): string {
  const lines = [
    heading,
    `- name: ${profile.name}`,
    `- mode: ${profile.mode}`,
    `- env vars: ${Object.keys(profile.env).join(", ") || "(none)"}`,
  ];

  const overrideLines = formatOverrides(profile);
  if (overrideLines.length > 0) {
    lines.push("Overrides:");
    lines.push(...overrideLines);
  }

  const providerLines = formatProviders(profile);
  if (providerLines.length > 0) {
    lines.push("Providers:");
    lines.push(...providerLines);
  }

  return lines.join("\n");
}

import { describe, expect, it } from "vitest";

import {
  decryptProfile,
  encryptProfile,
  parseEnvelopeText,
  serializeEnvelope,
} from "../src/crypto.js";
import { parseProfile } from "../src/profile.js";

describe("crypto", () => {
  it("round-trips an encrypted profile", () => {
    const profile = parseProfile({
      version: 1,
      name: "default",
      mode: "shared",
      env: {
        OPENAI_API_KEY: "sk-example",
      },
      overrides: {
        model_provider: "demo",
        model: "gpt-5.4",
      },
      providers: {
        demo: {
          name: "demo",
          baseUrl: "https://example.com",
          wireApi: "responses",
        },
      },
    });

    const encrypted = encryptProfile(profile, "passphrase");
    const reparsed = parseEnvelopeText(serializeEnvelope(encrypted));
    const decrypted = decryptProfile(reparsed, "passphrase");

    expect(decrypted).toEqual(profile);
  });

  it("fails when the passphrase is wrong", () => {
    const profile = parseProfile({
      version: 1,
      name: "default",
      mode: "shared",
      env: {
        OPENAI_API_KEY: "sk-example",
      },
      overrides: {},
      providers: {},
    });

    const encrypted = encryptProfile(profile, "passphrase");

    expect(() => decryptProfile(encrypted, "wrong")).toThrow(
      "Failed to decrypt profile. Check that the passphrase is correct.",
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  decryptProfile,
  encryptProfile,
} from "../src/crypto.js";
import { parseProfile } from "../src/profile.js";

describe("crypto", () => {
  it("round-trips an encrypted profile", async () => {
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

    const encrypted = await encryptProfile(profile, "passphrase");
    const decrypted = await decryptProfile(encrypted, "passphrase");

    expect(decrypted).toEqual(profile);
    expect(encrypted).toContain("BEGIN AGE ENCRYPTED FILE");
  });

  it("fails when the passphrase is wrong", async () => {
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

    const encrypted = await encryptProfile(profile, "passphrase");

    await expect(decryptProfile(encrypted, "wrong")).rejects.toThrow(
      "Failed to decrypt profile. Check that the passphrase is correct.",
    );
  });
});

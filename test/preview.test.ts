import { describe, expect, it } from "vitest";

import { formatProfileSummary, formatRemoteProfilePreview } from "../src/preview.js";
import { parseProfile } from "../src/profile.js";
import { parseProfileReference } from "../src/reference.js";

describe("preview formatting", () => {
  it("formats a remote profile preview before passphrase input", () => {
    const reference = parseProfileReference("zqysl/work");
    const preview = formatRemoteProfilePreview(reference, "encrypted-body");

    expect(preview).toContain("Profile source:");
    expect(preview).toContain("reference: zqysl/work");
    expect(preview).toContain(reference.rawUrl);
    expect(preview).toContain("encrypted size:");
  });

  it("formats a decrypted configuration summary", () => {
    const profile = parseProfile({
      version: 1,
      name: "work",
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
          name: "Demo",
          baseUrl: "https://example.com",
          wireApi: "responses",
        },
      },
    });

    const summary = formatProfileSummary(profile, "Configuration preview:");

    expect(summary).toContain("Configuration preview:");
    expect(summary).toContain("name: work");
    expect(summary).toContain("env vars: OPENAI_API_KEY");
    expect(summary).toContain("model_provider: demo");
    expect(summary).toContain("demo: https://example.com (responses)");
  });
});

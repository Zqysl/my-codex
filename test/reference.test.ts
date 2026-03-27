import { describe, expect, it } from "vitest";

import { buildCodexArgs } from "../src/codex.js";
import {
  formatProfileReference,
  parseProfileReference,
} from "../src/reference.js";
import { parseProfile } from "../src/profile.js";

describe("reference parsing", () => {
  it("maps an owner to the default profile", () => {
    const reference = parseProfileReference("zqysl");

    expect(reference.owner).toBe("zqysl");
    expect(reference.profile).toBe("default");
    expect(reference.filePath).toBe("profiles/default.age");
    expect(reference.rawUrl).toBe(
      "https://raw.githubusercontent.com/zqysl/my-codex/main/profiles/default.age",
    );
    expect(formatProfileReference(reference)).toBe("zqysl");
  });

  it("maps owner/profile to a named profile", () => {
    const reference = parseProfileReference("zqysl/work");

    expect(reference.owner).toBe("zqysl");
    expect(reference.profile).toBe("work");
    expect(reference.filePath).toBe("profiles/work.age");
    expect(formatProfileReference(reference)).toBe("zqysl/work");
  });
});

describe("codex overrides", () => {
  it("turns overrides and providers into codex -c args", () => {
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
          name: "Demo Provider",
          baseUrl: "https://example.com",
          wireApi: "responses",
        },
      },
    });

    expect(buildCodexArgs(profile)).toEqual([
      "-c",
      "model_provider=\"demo\"",
      "-c",
      "model=\"gpt-5.4\"",
      "-c",
      "model_providers.demo.name=\"Demo Provider\"",
      "-c",
      "model_providers.demo.base_url=\"https://example.com\"",
      "-c",
      "model_providers.demo.wire_api=\"responses\"",
    ]);
  });
});

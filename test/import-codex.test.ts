import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { importCodexProfile } from "../src/import-codex.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("importCodexProfile", () => {
  it("imports auth.json and config.toml into a profile", async () => {
    const codexHome = await mkdtemp(path.join(os.tmpdir(), "my-codex-test-"));
    tempDirs.push(codexHome);

    await writeFile(
      path.join(codexHome, "auth.json"),
      JSON.stringify({ OPENAI_API_KEY: "sk-example" }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(codexHome, "config.toml"),
      [
        'model_provider = "demo"',
        'model = "gpt-5.4"',
        'model_reasoning_effort = "xhigh"',
        "disable_response_storage = true",
        "",
        "[model_providers.demo]",
        'name = "Demo"',
        'base_url = "https://example.com"',
        'wire_api = "responses"',
        "",
        "[features]",
        "multi_agent = true",
      ].join("\n"),
      "utf8",
    );

    const profile = await importCodexProfile({
      codexHome,
      name: "default",
      mode: "shared",
    });

    expect(profile.env.OPENAI_API_KEY).toBe("sk-example");
    expect(profile.overrides).toMatchObject({
      model_provider: "demo",
      model: "gpt-5.4",
      model_reasoning_effort: "high",
      disable_response_storage: true,
      "features.multi_agent": true,
    });
    expect(profile.providers).toEqual({
      demo: {
        name: "Demo",
        baseUrl: "https://example.com",
        wireApi: "responses",
      },
    });
  });
});

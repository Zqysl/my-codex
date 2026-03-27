import { describe, expect, it } from "vitest";

import { maskHiddenInputOutput } from "../src/session.js";

describe("maskHiddenInputOutput", () => {
  it("keeps the prompt visible", () => {
    expect(maskHiddenInputOutput("Passphrase: ", "Passphrase: ")).toBe("Passphrase: ");
  });

  it("masks typed input", () => {
    expect(maskHiddenInputOutput("Passphrase: ", "secret")).toBe("******");
  });
});

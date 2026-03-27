import { describe, expect, it } from "vitest";

import {
  isAffirmativeResponse,
  maskHiddenInputOutput,
  shouldAssumeYes,
} from "../src/session.js";

describe("maskHiddenInputOutput", () => {
  it("keeps the prompt visible", () => {
    expect(maskHiddenInputOutput("Passphrase: ", "Passphrase: ")).toBe("Passphrase: ");
  });

  it("masks typed input", () => {
    expect(maskHiddenInputOutput("Passphrase: ", "secret")).toBe("******");
  });
});

describe("confirmation helpers", () => {
  it("recognizes affirmative responses", () => {
    expect(isAffirmativeResponse("y")).toBe(true);
    expect(isAffirmativeResponse("Yes")).toBe(true);
    expect(isAffirmativeResponse("n")).toBe(false);
  });

  it("recognizes assume-yes env values", () => {
    expect(shouldAssumeYes("1")).toBe(true);
    expect(shouldAssumeYes("true")).toBe(true);
    expect(shouldAssumeYes("yes")).toBe(true);
    expect(shouldAssumeYes("0")).toBe(false);
    expect(shouldAssumeYes(undefined)).toBe(false);
  });
});

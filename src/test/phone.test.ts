import { describe, it, expect } from "vitest";
import { countryOf, formatPhone, nationalDigits, isVisionxCode, formatVisionxCode } from "@/lib/phone";

describe("téléphone", () => {
  it("France : +33 6 66 66 66 66", () => {
    const fr = countryOf("FR");
    expect(formatPhone(fr, nationalDigits(fr, "06 66 66 66 66"))).toBe("+33 6 66 66 66 66");
  });
});
describe("VISIONX", () => {
  it("doit commencer par ZSCM", () => {
    expect(isVisionxCode("ZSCM12345")).toBe(true);
    expect(isVisionxCode("ABC12345")).toBe(false);
  });
});

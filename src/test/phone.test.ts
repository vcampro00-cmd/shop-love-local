import { describe, it, expect } from "vitest";
import { countryOf, formatPhone, nationalDigits, isVisionxCode, formatVisionxCode } from "@/lib/phone";

describe("téléphone", () => {
  it("France : +33 6 66 66 66 66", () => {
    const fr = countryOf("FR");
    expect(formatPhone(fr, nationalDigits(fr, "06 66 66 66 66"))).toBe("+33 6 66 66 66 66");
  });
});
describe("VISIONX", () => {
  it("accepte n'importe quel code, sans préfixe obligatoire", () => {
    expect(isVisionxCode("ZSCM12345")).toBe(true);
    expect(isVisionxCode("ABC12345")).toBe(true);
    expect(isVisionxCode("7788")).toBe(true);
    expect(isVisionxCode("ABC")).toBe(false);
  });
  it("a un tiret tous les 4 caractères", () => {
    expect(formatVisionxCode("ZSCM1234")).toBe("ZSCM-1234");
    expect(formatVisionxCode("ZSCM12345678")).toBe("ZSCM-1234-5678");
    expect(formatVisionxCode("abcd-1234-5678")).toBe("ABCD-1234-5678");
  });
});

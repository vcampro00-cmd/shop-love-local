import { describe, expect, it } from "vitest";
import { warrantyEnd } from "@/lib/warranty";
import { buildWarrantyPdf } from "@/lib/warranty.server";

describe("durée de la garantie", () => {
  it("compte à partir du jour du paiement", () => {
    expect(warrantyEnd("2026-10-29", 1)).toBe("2026-11-29");
    expect(warrantyEnd("2026-10-29", 4)).toBe("2027-02-28");
    expect(warrantyEnd("2026-01-31", 1)).toBe("2026-02-28");
  });
  it("imprime l'IMEI du téléphone quand il est renseigné", async () => {
    const pdf = await buildWarrantyPdf({ name: "Kelvyn", amount: 300, months: 2, paidAt: "2026-10-29T17:45:00Z", ref: "abcdef12-0000", imei: "354789102345678" });
    const zlib = await import("node:zlib");
    const raw = Buffer.from(pdf);
    // Le texte du PDF est compressé et écrit en hexadécimal : on décompresse puis on décode.
    let text = "";
    for (const m of raw.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
      try { text += zlib.inflateSync(Buffer.from(m[1] ?? "", "latin1")).toString("latin1"); } catch { text += m[1] ?? ""; }
    }
    const decoded = [...text.matchAll(/<([0-9A-F]+)>\s*Tj/g)].map((s) => Buffer.from(s[1] ?? "", "hex").toString("latin1")).join("\n");
    expect(decoded).toContain("IMEI du téléphone :");
  });
  it("produit un PDF", async () => {
    const pdf = await buildWarrantyPdf({ name: "Kelvyn", amount: 300, months: 2, paidAt: "2026-10-29T17:45:00Z", ref: "abcdef12-0000" });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    await import("node:fs").then((fs) => fs.writeFileSync("/tmp/garantie.pdf", pdf));
  });
});

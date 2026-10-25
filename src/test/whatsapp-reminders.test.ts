import { describe, expect, it } from "vitest";
import { isDueNow } from "@/lib/whatsapp.server";

describe("rappels WhatsApp : quels paiements sont dus", () => {
  const today = "2026-10-25";

  it("envoie le rappel le jour même", () => {
    expect(isDueNow("2026-10-25", today)).toBe(true);
  });

  it("envoie aussi les rappels dont la date est déjà passée", () => {
    expect(isDueNow("2026-10-16", today)).toBe(true);
    expect(isDueNow("2026-10-22", today)).toBe(true);
  });

  it("n'envoie pas encore ceux dont la date est à venir", () => {
    expect(isDueNow("2026-10-26", today)).toBe(false);
    expect(isDueNow("2026-11-30", today)).toBe(false);
  });
});

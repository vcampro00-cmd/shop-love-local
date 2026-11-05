import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

export type CancelReceipt = { name: string; ref: string; amountPaid: number; cancelledAmount: number; cancelledAt: string };

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} EUR`;

function paris(iso: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { day: `${g("day")}/${g("month")}/${g("year")}`, time: `${g("hour")}h${g("minute")}` };
}

/** Justificatif d'annulation du 2e paiement, avec logo et cachet VCAM PRO. */
export async function buildCancelReceiptPdf(c: CancelReceipt, logo?: Uint8Array | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const violet = rgb(0.45, 0.15, 0.7);
  const { day, time } = paris(c.cancelledAt);
  let y = 790;
  if (logo) {
    try {
      const img = await doc.embedPng(logo);
      const h = 70, wd = (img.width / img.height) * h;
      page.drawImage(img, { x: (595 - wd) / 2, y: y - h, width: wd, height: h });
      y -= h + 30;
    } catch { /* sans logo */ }
  }
  const center = (t: string, size: number, f = bold, color = rgb(0, 0, 0)) => {
    page.drawText(t, { x: (595 - f.widthOfTextAtSize(t, size)) / 2, y, size, font: f, color });
    y -= size + 14;
  };
  center("JUSTIFICATIF D'ANNULATION", 24, bold, violet);
  center("2E PAIEMENT ANNULÉ", 14);
  y -= 10;
  const line = (label: string, value: string) => {
    page.drawText(label, { x: 70, y, size: 12, font: bold });
    page.drawText(value, { x: 260, y, size: 12, font });
    y -= 24;
  };
  line("Client :", c.name.toUpperCase());
  line("Commande :", c.ref.toUpperCase());
  line("Déjà payé :", eur(c.amountPaid));
  line("Montant annulé :", eur(c.cancelledAmount));
  line("Date de l'annulation :", `${day} à ${time}`);
  y -= 16;
  const para = `La société VCAM PRO confirme que le 2e paiement de ${eur(c.cancelledAmount)} de la commande ${c.ref.toUpperCase()} a été annulé le ${day}. Aucun prélèvement automatique ne sera plus effectué sur la carte du client pour cette commande.`;
  let cur = "";
  for (const word of para.split(" ")) {
    const t = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(t, 12) > 455) { page.drawText(cur, { x: 70, y, size: 12, font }); y -= 18; cur = word; } else cur = t;
  }
  if (cur) { page.drawText(cur, { x: 70, y, size: 12, font }); y -= 18; }

  const cx = 420, cy = Math.min(y - 110, 300);
  page.drawEllipse({ x: cx, y: cy, xScale: 95, yScale: 60, borderColor: violet, borderWidth: 3, rotate: degrees(-12) });
  page.drawEllipse({ x: cx, y: cy, xScale: 85, yScale: 50, borderColor: violet, borderWidth: 1, rotate: degrees(-12) });
  const stamp = (t: string, size: number, dy: number, f = bold) => {
    const wd = f.widthOfTextAtSize(t, size);
    const a = (-12 * Math.PI) / 180;
    page.drawText(t, { x: cx - (wd / 2) * Math.cos(a) - dy * Math.sin(a), y: cy - (wd / 2) * Math.sin(a) + dy * Math.cos(a), size, font: f, color: violet, rotate: degrees(-12) });
  };
  stamp("VCAM PRO", 20, 8);
  stamp("PAIEMENT ANNULÉ", 9, -8);
  stamp(`${day} — ${time}`, 10, -24, font);
  page.drawText("VCAM PRO — vcampro.shop", { x: 70, y: 40, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  return doc.save();
}

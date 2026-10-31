import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { warrantyEnd, monthsLabel, frDate } from "./warranty";
import { whatsappDigits } from "./cash";

const SITE = "https://vcampro.shop";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/whatsapp";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const parisParts = (iso: string) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { day: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}h${g("minute")}` };
};

export type WarrantyRow = { name: string; amount: number; months: number; paidAt: string; ref: string; imei?: string | null };

export async function buildWarrantyPdf(w: WarrantyRow, logo?: Uint8Array | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const violet = rgb(0.45, 0.15, 0.7);
  const { day, time } = parisParts(w.paidAt);
  const end = warrantyEnd(day, w.months);
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
  center("CERTIFICAT DE GARANTIE", 24, bold, violet);
  center("GARANTIE DE PROGRAMMATION", 14);
  y -= 10;
  const line = (label: string, value: string) => {
    page.drawText(label, { x: 70, y, size: 12, font: bold });
    page.drawText(value, { x: 250, y, size: 12, font });
    y -= 24;
  };
  line("Client :", w.name.toUpperCase());
  line("Référence :", w.ref.slice(0, 8).toUpperCase());
  line("Date du paiement :", `${frDate(day)} à ${time}`);
  line("Durée de la garantie :", monthsLabel(w.months).toUpperCase());
  line("Valable jusqu'au :", frDate(end));
  if (w.imei) line("IMEI du téléphone :", w.imei.toUpperCase());
  y -= 16;
  const para = `La société VCAM PRO garantit le travail de programmation qu'elle a réalisé pendant ${monthsLabel(w.months)}, à compter du ${frDate(day)}, jour du paiement, jusqu'au ${frDate(end)} inclus. Cette garantie ne sera valable que sur présentation de ce document PDF.`;
  const words = para.split(" ");
  let cur = "";
  for (const word of words) {
    const t = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(t, 12) > 455) { page.drawText(cur, { x: 70, y, size: 12, font }); y -= 18; cur = word; } else cur = t;
  }
  if (cur) { page.drawText(cur, { x: 70, y, size: 12, font }); y -= 18; }

  // Cachet VCAM PRO avec date et heure.
  const cx = 420, cy = Math.min(y - 110, 300);
  page.drawEllipse({ x: cx, y: cy, xScale: 95, yScale: 60, borderColor: violet, borderWidth: 3, rotate: degrees(-12) });
  page.drawEllipse({ x: cx, y: cy, xScale: 85, yScale: 50, borderColor: violet, borderWidth: 1, rotate: degrees(-12) });
  const stamp = (t: string, size: number, dy: number, f = bold) => {
    const wd = f.widthOfTextAtSize(t, size);
    const a = (-12 * Math.PI) / 180;
    page.drawText(t, { x: cx - (wd / 2) * Math.cos(a) - dy * Math.sin(a), y: cy - (wd / 2) * Math.sin(a) + dy * Math.cos(a), size, font: f, color: violet, rotate: degrees(-12) });
  };
  stamp("VCAM PRO", 20, 8);
  stamp("GARANTIE VALIDÉE", 9, -8);
  stamp(`${frDate(day)} — ${time}`, 10, -24, font);
  page.drawText("VCAM PRO — vcampro.shop", { x: 70, y: 40, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  return doc.save();
}

/** Envoie sur WhatsApp, une seule fois, la garantie d'un rappel payé (si le propriétaire l'a demandée). */
export async function sendWarranty(reminderId: string): Promise<void> {
  const db = await admin();
  const { data: r } = await db.from("payment_reminders").select("id, name, phone, warranty_months, warranty_token, warranty_sent_at, paid_at").eq("id", reminderId).maybeSingle();
  if (!r || !r.warranty_months || r.warranty_sent_at || !r.paid_at) return;
  const to = whatsappDigits(r.phone ?? "");
  const lovable = process.env["LOVABLE_API_KEY"];
  const wa = process.env["WHATSAPP_API_KEY"];
  try {
    if (to.length < 8) throw new Error("Numéro invalide");
    if (!lovable || !wa) throw new Error("WhatsApp non configuré");
    const end = warrantyEnd(parisParts(r.paid_at).day, r.warranty_months);
    const res = await fetch(`${GATEWAY_URL}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": wa, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to, type: "template",
        template: {
          name: "vcampro_garantie", language: { code: "fr" },
          components: [
            { type: "body", parameters: [r.name, monthsLabel(r.warranty_months), frDate(end)].map((text) => ({ type: "text", text })) },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: r.warranty_token }] },
          ],
        },
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${body}`);
    await db.from("payment_reminders").update({ warranty_sent_at: new Date().toISOString(), warranty_error: null }).eq("id", r.id);
  } catch (e) {
    console.error("Warranty send failed", r.id, e);
    await db.from("payment_reminders").update({ warranty_error: String((e as Error).message).slice(0, 1000) }).eq("id", r.id);
  }
}

/** Reprend les garanties payées pas encore parties (appelé par le cron horaire). */
export async function sendPendingWarranties(): Promise<void> {
  const db = await admin();
  const { data } = await db.from("payment_reminders").select("id").not("warranty_months", "is", null).not("paid_at", "is", null).is("warranty_sent_at", null).eq("warranty_only", false).limit(20);
  for (const r of data ?? []) await sendWarranty(r.id);
}

export { SITE };

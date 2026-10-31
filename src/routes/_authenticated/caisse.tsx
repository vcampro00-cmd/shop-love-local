import { createFileRoute } from "@tanstack/react-router";
import { cancelSecondPayment, chargeSecondPaymentNow } from "@/lib/orders.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Download, MessageCircle, Trash2 } from "lucide-react";
import { addEmployee, addExpense, addReminder, addWarranty, deleteEmployee, deleteExpense, deleteReminder, getCashBook, listReminders, listWarranties, setWarrantyImei } from "@/lib/cash.functions";
import { setCashDrawer, payDebt, correctCashDrawer } from "@/lib/cash.functions";
import { purchaseDebts, cashInDrawer, availableMonths, employeeTotals, filterBookByMonth, formatDueDate, monthOf, normalizeBook, reminderMessage, stripeFee, summarizeCash, todayParis, whatsappDigits, type CashBook, type CashEntry } from "@/lib/cash";
import { brl } from "@/lib/products";
import { useText } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/caisse")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Caisse — Vcampro" },
      { name: "description", content: "Entrées, sorties et gains nets de la boutique Vcampro." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Caisse — Vcampro" },
      { property: "og:description", content: "Entrées, sorties et gains nets de la boutique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Caisse,
});

const today = () => new Date().toISOString().slice(0, 10);

type WarrantyInfo = { id: string; name: string; phone: string; months: number; token: string; paidAt: string; sent: boolean; imei: string; manual: boolean };

function WarrantyItem({ w }: { w: WarrantyInfo }) {
  const t = useText();
  const saveImei = useServerFn(setWarrantyImei);
  const [imei, setImei] = useState(w.imei);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await saveImei({ data: { id: w.id, imei } });
      toast.success(t("cash.reminderImeiSaved"));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
  }
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{w.name} — {w.months} MOIS{w.sent && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">ENVOYÉE</span>}{w.manual && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold">{t("cash.warrantyOnlyTag")}</span>}</p>
        <p className="truncate text-xs text-muted-foreground">{w.phone ? `+${w.phone} · ` : ""}{fmtDate(w.paidAt)}</p>
        <div className="mt-1 flex items-center gap-1">
          <Input value={imei} onChange={(e) => setImei(e.target.value)} maxLength={30} placeholder={t("cash.reminderImei")} aria-label={t("cash.reminderImei")} className="h-7 w-44 text-xs uppercase" />
          <button type="button" aria-label={t("cash.reminderImeiSaved")} disabled={busy} onClick={save} className="text-muted-foreground hover:text-primary disabled:opacity-50">
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <a href={`/garantie/${w.token}`} download={`garantie-${w.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`}>
          <Download className="h-4 w-4" /> {t("cash.warrantyDownload")}
        </a>
      </Button>
    </li>
  );
}

function Warranties() {
  const t = useText();
  const fetchW = useServerFn(listWarranties);
  const { data = [] } = useQuery({ queryKey: ["warranties"], queryFn: () => fetchW() });
  if (data.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">{t("cash.warrantiesTitle")}</h3>
      <ul className="mt-2 divide-y divide-border">
        {data.map((w) => <WarrantyItem key={w.id} w={w} />)}
      </ul>
    </div>
  );
}

/** Garantie seule, sans paiement sur le site : pour les ventes en espèces. */
function WarrantyOnlyForm() {
  const t = useText();
  const qc = useQueryClient();
  const addWar = useServerFn(addWarranty);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState(1);
  const [imei, setImei] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const value = Number(amount.replace(",", "."));
    const digits = whatsappDigits(phone);
    if (!name.trim() || !(value > 0) || digits.length < 8) { toast.error(t("cash.invalid")); return; }
    setBusy(true);
    try {
      await addWar({ data: { name, phone: digits, amount: value, months, imei } });
      toast.success(t("cash.warrantyOnlySaved"));
      setName(""); setPhone(""); setAmount(""); setMonths(1); setImei("");
      await qc.invalidateQueries({ queryKey: ["warranties"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : t("cash.invalid")); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_120px_130px_1fr_auto]">
      <Input placeholder={t("cash.reminderName")} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      <Input placeholder={t("cash.reminderPhone")} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
      <Input placeholder={t("cash.amountPlaceholder")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select aria-label={t("cash.reminderWarranty")} value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
        {[1, 2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{n} MOIS</option>)}
      </select>
      <Input placeholder={t("cash.reminderImei")} value={imei} onChange={(e) => setImei(e.target.value)} maxLength={30} className="uppercase" />
      <Button type="button" variant="outline" disabled={busy} onClick={submit}>{t("cash.warrantyOnlyAdd")}</Button>
    </div>
  );
}
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

type Kind = "entree" | "lien" | "sortie" | "achat" | "salaire";

const KINDS: { value: Kind; key: string }[] = [
  { value: "entree", key: "cash.kind.in" },
  { value: "lien", key: "cash.kind.link" },
  { value: "sortie", key: "cash.kind.out" },
  { value: "achat", key: "cash.kind.purchase" },
  { value: "salaire", key: "cash.kind.employee" },
];

function Caisse() {
  const t = useText();
  const qc = useQueryClient();
  const add = useServerFn(addExpense);
  const del = useServerFn(deleteExpense);
  const [kind, setKind] = useState<Kind>("entree");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  const addEmp = useServerFn(addEmployee);
  const delEmp = useServerFn(deleteEmployee);
  const [empName, setEmpName] = useState("");
  const [empId, setEmpId] = useState("");
  const addRem = useServerFn(addReminder);
  const delRem = useServerFn(deleteReminder);
  const cancelSecondFn = useServerFn(cancelSecondPayment);
  const chargeNowFn = useServerFn(chargeSecondPaymentNow);
  async function chargeNow(id: string) {
    if (!window.confirm(t("admin.chargeNow.confirm"))) return;
    try {
      const r = await chargeNowFn({ data: { id } });
      if ("error" in r) throw new Error(r.error);
      toast.success(t("admin.chargeNow.saved"));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    await qc.invalidateQueries();
  }
  async function cancelSecond(id: string) {
    if (!window.confirm(t("admin.cancelSecond.confirm"))) return;
    try { await cancelSecondFn({ data: { id } }); toast.success(t("admin.cancelSecond.saved")); await qc.invalidateQueries({ queryKey: ["reminders"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }
  const [remName, setRemName] = useState("");
  const [remPhone, setRemPhone] = useState("");
  const [remAmount, setRemAmount] = useState("");
  const [remNote, setRemNote] = useState("");
  const [remDate, setRemDate] = useState(today());
  const [remTimes, setRemTimes] = useState(1);
  const [remLang, setRemLang] = useState<"fr" | "pt">("fr");
  const [remWarranty, setRemWarranty] = useState(0);
  const [remImei, setRemImei] = useState("");
  const saveDrawer = useServerFn(setCashDrawer);
  const [drawerInput, setDrawerInput] = useState("");
  const fixDrawer = useServerFn(correctCashDrawer);
  const [fixing, setFixing] = useState(false);
  const [onCredit, setOnCredit] = useState(false);
  const pay = useServerFn(payDebt);
  const [payInputs, setPayInputs] = useState<Record<string, string>>({});

  const { data, error, isPending } = useQuery({ queryKey: ["cash-book"], queryFn: () => getCashBook(), retry: false });
  const { data: reminders = [] } = useQuery({ queryKey: ["reminders"], queryFn: () => listReminders(), retry: false });

  if (error)
    return <p className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">{t("admin.denied")}</p>;
  if (isPending)
    return <p className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">{t("admin.loading")}</p>;

  const current = monthOf(new Date().toISOString());
  const full = normalizeBook(data);
  const months = availableMonths(full, current);
  const selected = month ?? current;
  const book = filterBookByMonth(full, selected);
  const s = summarizeCash(book);
  const staff = full.staff ?? [];
  const empTotals = employeeTotals(book.employees);
  const debts = purchaseDebts(full.purchases, full.repayments ?? []);
  const num = (v: string) => Number(v.replace(",", "."));

  async function submitEmployee(ev: React.FormEvent) {
    ev.preventDefault();
    if (!empName.trim()) { toast.error(t("cash.invalid")); return; }
    try {
      await addEmp({ data: { name: empName, unit_price: 0 } });
      setEmpName("");
      await qc.invalidateQueries({ queryKey: ["cash-book"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : t("cash.invalid")); }
  }

  async function submitDrawer(ev: React.FormEvent) {
    ev.preventDefault();
    const value = num(drawerInput);
    if (drawerInput.trim() === "" || !(value >= 0)) { toast.error(t("cash.invalid")); return; }
    try {
      if (fixing) await fixDrawer({ data: { amount: value } });
      else await saveDrawer({ data: { amount: value } });
      setDrawerInput(""); setFixing(false);
      await qc.invalidateQueries({ queryKey: ["cash-book"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : t("cash.invalid")); }
  }

  async function submitPay(id: string) {
    const value = num(payInputs[id] ?? "");
    if (!(value > 0)) { toast.error(t("cash.invalid")); return; }
    try {
      await pay({ data: { purchaseId: id, amount: value } });
      setPayInputs((p) => ({ ...p, [id]: "" }));
      await qc.invalidateQueries({ queryKey: ["cash-book"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : t("cash.invalid")); }
  }

  async function removeEmployee(id: string) {
    if (!confirm(t("cash.confirmDelete"))) return;
    try { await delEmp({ data: { id } }); await qc.invalidateQueries({ queryKey: ["cash-book"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (kind === "salaire") {
      const value = num(amount);
      if (!empId || !(value > 0)) { toast.error(t("cash.invalid")); return; }
      setBusy(true);
      try {
        await add({ data: { label: "salaire", amount: value, spent_on: date, kind, employee_id: empId } });
        setAmount(""); setDate(today());
        await qc.invalidateQueries({ queryKey: ["cash-book"] });
      } catch (e) { toast.error(e instanceof Error ? e.message : t("cash.invalid")); }
      finally { setBusy(false); }
      return;
    }
    const value = Number(amount.replace(",", "."));
    if (!label.trim() || !(value > 0)) {
      toast.error(t("cash.invalid"));
      return;
    }
    setBusy(true);
    try {
      await add({ data: { label, amount: value, spent_on: date, kind, on_credit: kind === "achat" || kind === "entree" ? onCredit : undefined } });
      setLabel(""); setOnCredit(false); setAmount(""); setDate(today());
      await qc.invalidateQueries({ queryKey: ["cash-book"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("cash.invalid"));
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm(t("cash.confirmDelete"))) return;
    try { await del({ data: { id } }); await qc.invalidateQueries({ queryKey: ["cash-book"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  async function submitReminder(ev: React.FormEvent) {
    ev.preventDefault();
    const value = num(remAmount);
    const digits = whatsappDigits(remPhone);
    if (!remName.trim() || !(value > 0) || digits.length < 8 || !remDate) { toast.error(t("cash.invalid")); return; }
    try {
      const res = await addRem({ data: { name: remName, phone: digits, amount: value, note: remNote, dueDate: remDate, installments: remTimes, contractLang: remLang, warrantyMonths: remWarranty > 0 ? remWarranty : null, imei: remWarranty > 0 ? remImei : "" } });
      if (res.whatsapp?.sent) toast.success(t("cash.reminderWaSent"));
      else if (res.whatsapp?.failed) toast.error(t("cash.reminderWaFailed"));
      setRemName(""); setRemPhone(""); setRemAmount(""); setRemNote(""); setRemDate(today()); setRemTimes(1); setRemWarranty(0); setRemImei("");
      await qc.invalidateQueries({ queryKey: ["reminders"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : t("cash.invalid")); }
  }

  async function removeReminder(id: string) {
    if (!confirm(t("cash.confirmDelete"))) return;
    try { await delRem({ data: { id } }); await qc.invalidateQueries({ queryKey: ["reminders"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  function sendWhatsApp(r: { id: string; name: string; phone: string; amount: number; dueDate: string | null; paymentLink: string | null }) {
    // Toujours le lien court du site (/pagar/...) : jamais l'ancien lien Stripe enregistré.
    const link = `${window.location.origin}/pagar/${r.id}`;
    const msg = reminderMessage(t("cash.reminderMessage"), r, link);
    const url = `https://wa.me/${whatsappDigits(r.phone)}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">{t("cash.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("cash.intro")}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="cash-month">{t("cash.month")}</label>
        <select
          id="cash-month"
          value={selected}
          onChange={(e) => setMonth(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm capitalize"
        >
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}{m === current ? ` (${t("cash.currentMonth")})` : ""}</option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={() => exportPdf(book, selected, t)}>
          <Download className="h-4 w-4" /> {t("cash.pdf")}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("cash.inCard")} value={brl(s.cardIn)} />
        <Stat label={t("cash.out")} value={brl(s.outTotal)} />
        <Stat label={t("cash.purchases")} value={brl(s.purchaseTotal)} />
        <Stat label={t("cash.net")} value={brl(s.net)} strong />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4">
        <span className="text-sm font-semibold">{t("cash.linkTotal")} ({book.entries.filter((e) => e.link).length})</span>
        <span className="text-lg font-bold">{brl(book.entries.filter((e) => e.link).reduce((sum, e) => sum + e.amount, 0))}</span>
      </div>

      <form onSubmit={submit} className="mt-8 rounded-2xl border bg-card p-5">
        <fieldset className="border-0 p-0">
          <legend className="text-sm font-medium">{t("cash.kindLabel")}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {KINDS.map((k) => (
              <label
                key={k.value}
                className={`relative flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                  kind === k.value ? "border-primary bg-primary/10" : "border-input hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="cash-kind"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    kind === k.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
                  }`}
                >
                  {kind === k.value && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="font-medium">{t(k.key)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === "salaire" ? (
          staff.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("cash.staffEmpty")}</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_160px_auto]">
              <select
                aria-label={t("cash.staffPick")}
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("cash.staffPick")}</option>
                {staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <Input placeholder={t("cash.amountPlaceholder")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button type="submit" disabled={busy}>
                {t("cash.add")}
              </Button>
            </div>
          )
        ) : (
          <>
          {kind === "achat" && (
            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup">
              {[{ v: false, k: "cash.payNow" }, { v: true, k: "cash.payLater" }].map((o) => (
                <Button key={o.k} type="button" role="radio" aria-checked={onCredit === o.v} variant={onCredit === o.v ? "default" : "outline"} onClick={() => setOnCredit(o.v)}>
                  {onCredit === o.v && <Check className="h-4 w-4" />} {t(o.k)}
                </Button>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_160px_auto]">
            <Input placeholder={t("cash.labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
            <Input placeholder={t("cash.amountPlaceholder")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button type="submit" disabled={busy}>{t("cash.add")}</Button>
          </div>
          </>
        )}
      </form>

      {debts.length > 0 && (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t("cash.debtsTitle")}</h2>
            <p className="text-sm">{t("cash.debtsTotal")} : <span className="text-lg font-bold text-destructive">−{brl(debts.reduce((x, d) => x + d.remaining, 0))}</span></p>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {debts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(d.date)} · {brl(d.amount)} · {t("cash.debtPaid")} {brl(d.paid)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-destructive">−{brl(d.remaining)}</span>
                  <Input inputMode="decimal" placeholder="0,00" className="w-24" aria-label={t("cash.debtPay")} value={payInputs[d.id] ?? ""} onChange={(e) => setPayInputs((p) => ({ ...p, [d.id]: e.target.value }))} />
                  <Button type="button" size="sm" onClick={() => submitPay(d.id)}>{t("cash.debtPay")}</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submitEmployee} className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t("cash.staffTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input placeholder={t("cash.staffName")} value={empName} onChange={(e) => setEmpName(e.target.value)} maxLength={100} />
          <Button type="submit" variant="outline">{t("cash.staffAdd")}</Button>
        </div>
        {staff.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {staff.map((x) => {
              const paid = empTotals.find((e) => e.name === x.name)?.total ?? 0;
              return (
                <li key={x.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{x.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{brl(paid)}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => exportPayslip(full.employees.filter((r) => r.label === x.name), x.name, t)}>
                      <Download className="h-4 w-4" /> {t("cash.payslip")}
                    </Button>
                    <button type="button" aria-label="Supprimer" onClick={() => removeEmployee(x.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </form>

      <form onSubmit={submitReminder} className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t("cash.remindersTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("cash.remindersIntro")}</p>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
          <span className="text-sm font-semibold">{t("cash.remindersOpenTotal")} ({reminders.filter((r) => !r.paid).length})</span>
          <span className="text-lg font-bold text-primary">{brl(reminders.filter((r) => !r.paid).reduce((s, r) => s + Number(r.amount || 0), 0))}</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_140px_160px_90px_auto]">
          <Input placeholder={t("cash.reminderName")} value={remName} onChange={(e) => setRemName(e.target.value)} maxLength={100} />
          <Input placeholder={t("cash.reminderPhone")} inputMode="tel" value={remPhone} onChange={(e) => setRemPhone(e.target.value)} maxLength={20} />
          <Input placeholder={t("cash.amountPlaceholder")} inputMode="decimal" value={remAmount} onChange={(e) => setRemAmount(e.target.value)} />
          <Input type="date" aria-label={t("cash.reminderDate")} value={remDate} onChange={(e) => setRemDate(e.target.value)} />
          <select aria-label={t("cash.reminderTimes")} value={remTimes} onChange={(e) => setRemTimes(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}× {t("cash.reminderTimes")}</option>)}
          </select>
          {remTimes > 1 && (
            <select aria-label={t("cash.reminderLang")} value={remLang} onChange={(e) => setRemLang(e.target.value === "pt" ? "pt" : "fr")} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="fr">{t("cash.reminderLang")} : FRANÇAIS</option>
              <option value="pt">{t("cash.reminderLang")} : PORTUGUÊS</option>
            </select>
          )}
          <select aria-label={t("cash.reminderWarranty")} value={remWarranty} onChange={(e) => setRemWarranty(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value={0}>{t("cash.reminderWarranty")} : {t("cash.reminderWarrantyNone")}</option>
            {[1, 2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{t("cash.reminderWarranty")} : {n} MOIS</option>)}
          </select>
          {remWarranty > 0 && (
            <Input placeholder={t("cash.reminderImei")} value={remImei} onChange={(e) => setRemImei(e.target.value)} maxLength={30} className="uppercase" />
          )}
          <Button type="submit" variant="outline">{t("cash.reminderAdd")}</Button>
        </div>
        <Input className="mt-3" placeholder={t("cash.reminderNote")} value={remNote} onChange={(e) => setRemNote(e.target.value)} maxLength={300} />
        {reminders.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {reminders.map((r) => (
              <li key={r.id} className={`flex items-center justify-between gap-3 py-2 text-sm ${r.failed ? "rounded-lg border border-destructive bg-destructive/15 px-2" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {r.name} — {brl(r.amount)}
                    {r.paid && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">PAYÉ</span>}
                    {r.fromOrder && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold">VENTE DU SITE</span>}
                    {r.failed && <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">ÉCHEC</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{r.phone ? `+${r.phone}` : ""}{r.dueDate ? ` · ${t("cash.reminderDate")} : ${formatDueDate(r.dueDate)}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
                </div>
                {r.fromOrder && !r.paid && (!r.dueDate || r.dueDate <= todayParis()) && (
                  <Button type="button" size="sm" className="bg-brand" onClick={() => chargeNow(r.id)}>{t("admin.chargeNow.button")}</Button>
                )}
                {r.failed && (
                  <Button type="button" size="sm" variant="destructive" onClick={() => cancelSecond(r.id)}>{t("admin.cancelSecond.button")}</Button>
                )}
                {!r.fromOrder && (
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => sendWhatsApp(r)}>
                    <MessageCircle className="h-4 w-4" /> {t("cash.reminderSend")}
                  </Button>
                  <button type="button" aria-label="Supprimer" onClick={() => removeReminder(r.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{t("cash.warrantyOnlyTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("cash.warrantyOnlyIntro")}</p>
        <WarrantyOnlyForm />
        <Warranties />
      </div>


      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <EntriesList title={t("cash.in")} empty={t("cash.emptyIn")} rows={book.entries} onDelete={remove} />
        <List title={t("cash.out")} empty={t("cash.emptyOut")} rows={book.expenses} sign="−" onDelete={remove} />
        <List title={t("cash.purchases")} empty={t("cash.emptyPurchases")} rows={book.purchases} sign="−" onDelete={remove} />
        <List title={t("cash.employees")} empty={t("cash.emptyEmployees")} rows={book.employees} sign="−" onDelete={remove} />
      </div>
    </div>
  );
}

function monthLabel(m: string) {
  return new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

const eur = (n: number) => n.toFixed(2).replace(".", ",") + " EUR";

async function loadLogoDataUrl(): Promise<{ data: string; width: number; height: number } | null> {
  try {
    const mod = await import("@/assets/vcampro-logo.png");
    const res = await fetch(mod.default);
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = data;
    });
    return { data, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

async function exportPdf(book: CashBook, month: string, t: (k: string) => string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const s = summarizeCash(book);
  const logo = await loadLogoDataUrl();
  let y = 20;
  // Cabeçalho personalizado com a logo
  if (logo) {
    const h = 22;
    const w = (logo.width / logo.height) * h;
    doc.addImage(logo.data, "PNG", (210 - w) / 2, y, w, h);
    y += h + 6;
  }
  doc.setDrawColor(168, 85, 247);
  doc.setLineWidth(0.8);
  doc.line(14, y, 196, y);
  y += 8;
  const line = (txt: string, size = 10, bold = false) => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(txt, 14, y);
    y += size * 0.55;
  };
  const row = (r: CashEntry, sign: string) => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(fmtDate(r.date), 14, y);
    doc.text((r.units != null && r.unitPrice != null ? `${r.label} (${r.units} x ${eur(r.unitPrice)})` : r.label).slice(0, 70), 40, y);
    doc.text(`${sign} ${eur(r.amount)}`, 196, y, { align: "right" });
    y += 6;
  };
  line(`Vcampro — ${t("cash.title")}`, 18, true); y += 2;
  line(monthLabel(month), 13); y += 4;
  line(`${t("cash.inCard")} : ${eur(s.cardIn)}`, 11);
  line(`${t("cash.out")} : ${eur(s.outTotal)}`, 11);
  line(`${t("cash.purchases")} : ${eur(s.purchaseTotal)}`, 11);
  for (const e of employeeTotals(book.employees)) line(`${e.name} : ${eur(e.total)}`, 11);
  line(`${t("cash.net")} : ${eur(s.net)}`, 12, true); y += 4;
  const section = (title: string, rows: CashEntry[], sign: string, empty: string) => {
    line(title, 12, true); y += 1;
    if (rows.length === 0) line(empty);
    rows.forEach((r) => row(r, sign));
    y += 4;
  };
  section(t("cash.in"), book.entries, "+", t("cash.emptyIn"));
  section(t("cash.out"), book.expenses, "-", t("cash.emptyOut"));
  section(t("cash.purchases"), book.purchases, "-", t("cash.emptyPurchases"));
  section(t("cash.employees"), book.employees, "-", t("cash.emptyEmployees"));
  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(168, 85, 247);
    doc.setLineWidth(0.4);
    doc.line(14, 285, 196, 285);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`VCAMPRO — vcampro.shop — ${i}/${pages}`, 105, 290, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }
  doc.save(`caisse-vcampro-${month}.pdf`);
}

async function exportPayslip(rows: CashEntry[], name: string, t: (k: string) => string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const logo = await loadLogoDataUrl();
  let y = 20;
  if (logo) {
    const h = 22;
    const w = (logo.width / logo.height) * h;
    doc.addImage(logo.data, "PNG", (210 - w) / 2, y, w, h);
    y += h + 6;
  }
  doc.setDrawColor(168, 85, 247);
  doc.setLineWidth(0.8);
  doc.line(14, y, 196, y);
  y += 10;
  const brk = () => { if (y > 275) { doc.addPage(); y = 20; } };
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(t("cash.payslipTitle").toUpperCase(), 14, y); y += 9;
  doc.setFontSize(12);
  doc.text(`EMPLOYÉ : ${name.toUpperCase()}`, 14, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`ÉMIS LE ${fmtDate(new Date().toISOString().slice(0, 10))}`, 14, y); y += 10;

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = new Map<string, CashEntry[]>();
  for (const r of sorted) {
    const m = monthOf(r.date);
    byMonth.set(m, [...(byMonth.get(m) ?? []), r]);
  }
  let total = 0;
  if (sorted.length === 0) { doc.text("AUCUN PAIEMENT ENREGISTRÉ.", 14, y); y += 8; }
  for (const [m, list] of byMonth) {
    brk();
    doc.setFillColor(243, 232, 255);
    doc.rect(14, y - 5, 182, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(monthLabel(m).toUpperCase(), 16, y);
    y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    let sub = 0;
    for (const r of list) {
      brk();
      doc.text(fmtDate(r.date), 18, y);
      doc.text("PAIEMENT", 50, y);
      doc.text(eur(r.amount), 196, y, { align: "right" });
      sub += r.amount; y += 6;
    }
    doc.setFont("helvetica", "bold");
    doc.text(`SOUS-TOTAL ${monthLabel(m).toUpperCase()}`, 50, y);
    doc.text(eur(sub), 196, y, { align: "right" });
    total += sub; y += 10;
  }
  brk();
  doc.setDrawColor(168, 85, 247); doc.setLineWidth(0.6);
  doc.line(14, y - 4, 196, y - 4);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("TOTAL REÇU", 14, y + 2);
  doc.text(eur(total), 196, y + 2, { align: "right" });
  y += 20; brk();
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("SIGNATURE EMPLOYEUR", 14, y);
  doc.text("SIGNATURE EMPLOYÉ", 120, y);
  doc.line(14, y + 14, 90, y + 14);
  doc.line(120, y + 14, 196, y + 14);
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(168, 85, 247); doc.setLineWidth(0.4);
    doc.line(14, 285, 196, 285);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(`VCAMPRO — vcampro.shop — ${i}/${pages}`, 105, 290, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }
  doc.save(`fiche-paie-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${strong ? "bg-primary/10 border-primary/40" : "bg-card"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function EntriesList({ title, empty, rows, onDelete }: { title: string; empty: string; rows: CashEntry[]; onDelete: (id: string) => void }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">
                  {r.label}
                  {r.manual && <span className="ml-2 text-xs text-muted-foreground">(manuel)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(r.date)} · {r.kind === "especes" ? "ESPÈCES" : `−${brl(stripeFee(r.amount))} Stripe`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">+ {brl(r.amount)}</span>
                {r.manual && (
                  <button type="button" aria-label="Supprimer" onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function List({ title, empty, rows, sign, onDelete }: { title: string; empty: string; rows: CashEntry[]; sign: string; onDelete: (id: string) => void }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(r.date)}
                  {r.units != null && r.unitPrice != null && ` · ${r.units} × ${brl(r.unitPrice)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{sign} {brl(r.amount)}</span>
                <button type="button" aria-label="Supprimer" onClick={() => onDelete(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

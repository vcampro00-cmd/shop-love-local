import { formatDueDate } from "./cash";

export type ScheduledPayment = { amount: number; dueDate: string | null };

/** Numeric schedule shared by the automatic and manual WhatsApp confirmations. */
export function paymentSchedule(payments: ScheduledPayment[]): string {
  return [...payments]
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .map((p) => `${p.amount.toFixed(2).replace(".", ",")} €${p.dueDate ? ` — ${formatDueDate(p.dueDate)}` : ""}`)
    .join(" ; ");
}
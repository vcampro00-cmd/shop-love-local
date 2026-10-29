/** Fin de garantie : même jour, N mois après le paiement (dernier jour du mois si besoin). Dates "AAAA-MM-JJ". */
export function warrantyEnd(paidDay: string, months: number): string {
  const [y, m, d] = paidDay.split("-").map(Number);
  const total = y! * 12 + (m! - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d!, last)).padStart(2, "0")}`;
}

export const monthsLabel = (n: number) => `${n} mois`;
export const frDate = (d: string) => d.split("-").reverse().join("/");

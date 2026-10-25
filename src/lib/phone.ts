// Pays proposés au client pour son téléphone, avec l'indicatif et le découpage des chiffres.
export type PhoneCountry = { code: string; name: string; dial: string; groups: number[] };

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "FR", name: "France", dial: "33", groups: [1, 2, 2, 2, 2] },
  { code: "ES", name: "Espagne", dial: "34", groups: [3, 3, 3] },
  { code: "BE", name: "Belgique", dial: "32", groups: [3, 2, 2, 2] },
  { code: "PT", name: "Portugal", dial: "351", groups: [3, 3, 3] },
  { code: "DZ", name: "Algérie", dial: "213", groups: [3, 2, 2, 2] },
  { code: "BR", name: "Brésil", dial: "55", groups: [2, 5, 4] },
];

export function countryOf(code: string) {
  return PHONE_COUNTRIES.find((c) => c.code === code) ?? PHONE_COUNTRIES[0]!;
}

/** Garde seulement les chiffres nationaux (sans le 0 initial), limités à la longueur du pays. */
export function nationalDigits(country: PhoneCountry, raw: string) {
  const max = country.groups.reduce((a, b) => a + b, 0);
  return raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, max);
}

/** Ex. France + "666666666" → "+33 6 66 66 66 66". */
export function formatPhone(country: PhoneCountry, digits: string) {
  const parts: string[] = [];
  let i = 0;
  for (const g of country.groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + g));
    i += g;
  }
  return [`+${country.dial}`, ...parts].join(" ");
}

export function isCompletePhone(country: PhoneCountry, digits: string) {
  return digits.length === country.groups.reduce((a, b) => a + b, 0);
}

/** Code VISIONX saisi par le propriétaire : commence obligatoirement par ZSCM. */
export function isVisionxCode(v: string) {
  return /^ZSCM[A-Z0-9-]{1,60}$/.test(v.trim().toUpperCase());
}

/** Affiche le code VISIONX avec un tiret tous les 4 caractères (ZSCM-1234-5678). */
export function formatVisionxCode(v: string) {
  const d = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return d.replace(/(.{4})(?=.)/g, "$1-");
}

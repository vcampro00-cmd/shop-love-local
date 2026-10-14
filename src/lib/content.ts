import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getSiteTexts } from "./content.functions";
import { DEFAULTS } from "./content.defaults";

export const siteTextsQueryOptions = queryOptions({
  queryKey: ["site-texts"],
  queryFn: () => getSiteTexts(),
});

/** Texte du site : la saisie du propriétaire, sinon la valeur par défaut du fichier. */
export function useText() {
  const { data } = useSuspenseQuery(siteTextsQueryOptions);
  return (key: string): string => {
    const saved = data?.[key];
    return saved && saved.trim() ? saved : (DEFAULTS[key] ?? "");
  };
}

/** "300 €", "300,00" ou "300" → 300. Valeur non numérique ou négative → fallback. */
export function numFromText(value: string, fallback: number): number {
  const n = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

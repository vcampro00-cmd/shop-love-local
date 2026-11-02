import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getSiteTexts } from "./content.functions";
import { DEFAULTS } from "./content.defaults";
import { DEFAULTS_PT } from "./content.defaults.pt";
import { useLang, type Lang } from "./lang";

export const siteTextsQueryOptions = queryOptions({
  queryKey: ["site-texts"],
  queryFn: () => getSiteTexts(),
});

/** Clé d'enregistrement d'un texte en portugais dans la table site_texts. */
export const ptKey = (key: string): string => `${key}__pt`;

// Les prix et les frais sont communs aux deux langues : ils ne passent jamais
// par la couche portugaise (la valeur française fait foi).
export function isMoneyKey(key: string): boolean {
  return key === "delivery.fee" || (key.startsWith("product.") && key.endsWith(".price"));
}

/** Texte affiché pour une clé : saisie du propriétaire dans la langue choisie,
 *  sinon traduction par défaut, sinon la valeur française (saisie puis défaut). */
export function resolveText(key: string, lang: Lang, saved: Record<string, string> | undefined): string {
  if (lang === "pt" && !isMoneyKey(key)) {
    const ptSaved = saved?.[ptKey(key)];
    if (ptSaved && ptSaved.trim()) return ptSaved;
    const ptDefault = DEFAULTS_PT[key];
    if (ptDefault && ptDefault.trim()) return ptDefault;
  }
  const savedFr = saved?.[key];
  return savedFr && savedFr.trim() ? savedFr : (DEFAULTS[key] ?? "");
}

/** Texte du site dans la langue du visiteur : la saisie du propriétaire, sinon la valeur par défaut. */
export function useText() {
  const { data } = useSuspenseQuery(siteTextsQueryOptions);
  const lang = useLang();
  return (key: string): string => resolveText(key, lang, data);
}

/** "300 €", "300,00" ou "300" → 300. Valeur non numérique ou négative → fallback. */
export function numFromText(value: string, fallback: number): number {
  const n = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

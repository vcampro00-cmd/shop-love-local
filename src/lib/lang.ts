import { useEffect, useState } from "react";

export type Lang = "fr" | "pt";

const STORAGE_KEY = "vcampro-lang";

// Langue du site : « fr » par défaut, choix mémorisé dans le navigateur du visiteur.
// La préférence est lue après l'hydratation pour éviter tout décalage serveur/navigateur.
let current: Lang = "fr";
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Stockage indisponible : la langue reste valable pour la session en cours.
  }
  for (const notify of listeners) notify();
}

export function useLang(): Lang {
  const [, force] = useState(0);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Stockage indisponible : on garde « fr ».
    }
    if (saved === "pt") current = "pt";
    const notify = () => force((n) => n + 1);
    listeners.add(notify);
    notify();
    return () => {
      listeners.delete(notify);
    };
  }, []);
  return current;
}

/** x("texte français", "texto em português") : renvoie le texte dans la langue choisie. */
export function useX() {
  const lang = useLang();
  return (fr: string, pt: string) => (lang === "pt" ? pt : fr);
}

/** Locale de date selon la langue choisie. */
export function dateLocale(lang: Lang): string {
  return lang === "pt" ? "pt-BR" : "fr-FR";
}

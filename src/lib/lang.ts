import { useEffect, useSyncExternalStore } from "react";

export type Lang = "fr" | "pt";

const STORAGE_KEY = "vcampro-lang";

// Langue du site : « fr » côté serveur et au premier rendu, choix mémorisé du
// visiteur appliqué après l'hydratation via useSyncExternalStore (le patron
// prévu par React : le serveur et le premier rendu affichent le français, puis
// le navigateur bascule sur la langue enregistrée sans erreur d'hydratation).
let current: Lang = "fr";
const listeners = new Set<() => void>();

/** Instantané vu par le serveur : toujours le français. */
function getServerLang(): Lang {
  return "fr";
}

export function getLang(): Lang {
  return current;
}

function subscribeLang(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
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
  // La préférence enregistrée est lue une fois par composant après le montage.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Stockage indisponible : on garde « fr ».
    }
    if (saved === "pt") setLang("pt");
  }, []);
  return useSyncExternalStore(subscribeLang, getLang, getServerLang);
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

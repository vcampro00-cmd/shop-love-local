// Textes visibles du site, éditables par le propriétaire dans /editar.
// Chaque clé a une valeur par défaut ici ; une saisie du propriétaire est stockée
// dans la table site_texts et prend le dessus sur ce fichier.

export const DEFAULTS: Record<string, string> = {
  // Accueil
  "home.heroTitleA": "Achetez en ligne chez",
  "home.heroTitleB": "Vcampro",
  "home.heroSubtitle": "Payez sur le site et recevez votre commande à votre adresse.",
  "home.ctaPrimary": "Voir les téléphones",
  "home.ctaSecondary": "Comment ça marche",
  "home.card1Title": "Paiement en ligne",
  "home.card1Text": "Sécurisé, directement sur le site.",
  "home.card2Title": "Livraison",
  "home.card2Text": "Reçue à votre adresse.",
  "home.productsTitle": "Téléphones",
  "home.planNote": "Abonnement à l'application : 20 € par semaine",

  // Fiche iPhone SE 2020
  "product.iphone-se-2020.name": "iPhone SE 2020",
  "product.iphone-se-2020.tag": "Apple",
  "product.iphone-se-2020.description": "Téléphone dédié à Uber et Bolt, fonctionnel et pratique. Le téléphone reste avec le chauffeur.",
  "product.iphone-se-2020.price": "300",

  // Fiche Clone Deliveroo
  "product.clone-deliveroo.name": "Clone Deliveroo",
  "product.clone-deliveroo.tag": "Android ×2",
  "product.clone-deliveroo.description": "Deux téléphones comme s'ils n'étaient qu'un seul : l'un reste avec le propriétaire, l'autre avec le livreur. Quand le propriétaire prend un selfie sur le sien, celui du livreur se débloque automatiquement. Pour cela, il y a un abonnement de 15 € par semaine.",
  "product.clone-deliveroo.price": "380",

  // Livraison
  "delivery.fee": "5",
  "delivery.label": "Livraison",

  // Comment ça marche
  "steps.titleA": "Comment",
  "steps.titleB": "commander",
  "steps.intro": "Acheter chez Vcampro est simple. Voici les étapes :",
  "steps.1.title": "Choisissez vos téléphones",
  "steps.1.text": "Ajoutez au panier les téléphones souhaités et ajustez les quantités.",
  "steps.2.title": "Livraison à votre adresse",
  "steps.2.text": "Faites-vous livrer à l'adresse indiquée.",
  "steps.3.title": "Remplissez vos informations",
  "steps.3.text": "Indiquez nom, téléphone et adresse complète de livraison.",
  "steps.4.title": "Payez sur le site",
  "steps.4.text": "Réglez votre commande en ligne en toute sécurité.",
  "steps.5.title": "Suivez votre commande",
  "steps.5.text": "Vous recevez un numéro de commande. Nous vous prévenons quand elle est en route.",

  // Panier et paiement
  "cart.title": "Panier",
  "cart.empty": "Votre panier est vide",
  "cart.emptyCta": "Voir les téléphones",
  "cart.addressTitle": "Adresse de livraison",
  "form.name": "Nom",
  "form.phone": "Téléphone",
  "form.address": "Adresse (rue, numéro, ville)",
  "form.cep": "Code postal",
  "form.notes": "Remarques sur la commande",
  "form.notesPlaceholder": "Ex. : couleur préférée, code d'accès...",
  "cart.summary": "Récapitulatif",
  "cart.subtotal": "Sous-total",
  "cart.total": "Total",
  "cart.pay": "Payer",
  "cart.demoNote": "Mode démonstration — aucun montant n'est encore débité.",

  // Confirmation de commande
  "order.title": "Commande reçue !",
  "order.info": "Votre commande sera préparée puis envoyée à l'adresse indiquée. Nous vous prévenons par téléphone à l'expédition.",
  "order.continue": "Continuer mes achats",

  // Navigation et pied de page
  "nav.shop": "Boutique",
  "nav.how": "Comment ça marche",
  "nav.cart": "Panier",
  "footer.line1": "© Vcampro — Achetez en ligne et faites-vous livrer.",
  "footer.line2": "Abonnement à l'application : 20 € par semaine.",
};

export type FieldKind = "text" | "long" | "money";

export type EditorField = { key: string; label: string; kind: FieldKind };
export type EditorGroup = { title: string; fields: EditorField[] };

const money = (key: string, label: string): EditorField => ({ key, label, kind: "money" });
const text = (key: string, label: string): EditorField => ({ key, label, kind: "text" });
const long = (key: string, label: string): EditorField => ({ key, label, kind: "long" });

export const EDITOR_GROUPS: EditorGroup[] = [
  {
    title: "Page d'accueil",
    fields: [
      text("home.heroTitleA", "Titre — première partie"),
      text("home.heroTitleB", "Titre — partie en violet"),
      long("home.heroSubtitle", "Phrase sous le titre"),
      text("home.ctaPrimary", "Bouton principal"),
      text("home.ctaSecondary", "Bouton secondaire"),
      text("home.card1Title", "Carte 1 — titre"),
      text("home.card1Text", "Carte 1 — texte"),
      text("home.card2Title", "Carte 2 — titre"),
      text("home.card2Text", "Carte 2 — texte"),
      text("home.productsTitle", "Titre de la section des téléphones"),
      long("home.planNote", "Remarque sous les téléphones"),
    ],
  },
  {
    title: "iPhone SE 2020",
    fields: [
      text("product.iphone-se-2020.name", "Nom"),
      text("product.iphone-se-2020.tag", "Étiquette"),
      long("product.iphone-se-2020.description", "Description"),
      money("product.iphone-se-2020.price", "Prix en euros"),
    ],
  },
  {
    title: "Clone Deliveroo",
    fields: [
      text("product.clone-deliveroo.name", "Nom"),
      text("product.clone-deliveroo.tag", "Étiquette"),
      long("product.clone-deliveroo.description", "Description"),
      money("product.clone-deliveroo.price", "Prix en euros"),
    ],
  },
  {
    title: "Livraison",
    fields: [money("delivery.fee", "Frais de livraison en euros"), text("delivery.label", "Nom de la ligne au panier")],
  },
  {
    title: "Page « Comment ça marche »",
    fields: [
      text("steps.titleA", "Titre — première partie"),
      text("steps.titleB", "Titre — partie en violet"),
      long("steps.intro", "Phrase d'introduction"),
      text("steps.1.title", "Étape 1 — titre"),
      long("steps.1.text", "Étape 1 — texte"),
      text("steps.2.title", "Étape 2 — titre"),
      long("steps.2.text", "Étape 2 — texte"),
      text("steps.3.title", "Étape 3 — titre"),
      long("steps.3.text", "Étape 3 — texte"),
      text("steps.4.title", "Étape 4 — titre"),
      long("steps.4.text", "Étape 4 — texte"),
      text("steps.5.title", "Étape 5 — titre"),
      long("steps.5.text", "Étape 5 — texte"),
    ],
  },
  {
    title: "Panier et paiement",
    fields: [
      text("cart.title", "Titre de la page"),
      text("cart.empty", "Panier vide — message"),
      text("cart.emptyCta", "Panier vide — bouton"),
      text("cart.addressTitle", "Titre du bloc d'adresse"),
      text("form.name", "Champ — nom"),
      text("form.phone", "Champ — téléphone"),
      text("form.address", "Champ — adresse"),
      text("form.cep", "Champ — code postal"),
      text("form.notes", "Champ — remarques"),
      text("form.notesPlaceholder", "Champ — exemple de remarque"),
      text("cart.summary", "Récapitulatif — titre"),
      text("cart.subtotal", "Ligne sous-total"),
      text("delivery.label", "Ligne livraison"),
      text("cart.total", "Ligne total"),
      text("cart.pay", "Bouton de paiement (avant le montant)"),
      long("cart.demoNote", "Petite note sous le bouton"),
    ],
  },
  {
    title: "Confirmation de commande",
    fields: [
      text("order.title", "Titre"),
      long("order.info", "Message"),
      text("order.continue", "Bouton"),
    ],
  },
  {
    title: "Menu et pied de page",
    fields: [
      text("nav.shop", "Menu — lien boutique"),
      text("nav.how", "Menu — lien explication"),
      text("nav.cart", "Menu — bouton panier"),
      long("footer.line1", "Pied de page — ligne 1"),
      long("footer.line2", "Pied de page — ligne 2"),
    ],
  },
];

export const ALL_EDITOR_KEYS = EDITOR_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

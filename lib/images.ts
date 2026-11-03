// Emplacements d'images de la plateforme.
// Dépose une photo dans /public/images/<slot>.jpg et elle remplace automatiquement l'illustration par défaut.
// Format conseillé : JPG, 1600 px de large, moins de 400 Ko.

export type Slot =
  | "hero"
  | "lire"
  | "traduire"
  | "valider"
  | "sante"
  | "telephonie"
  | "cinema"
  | "communaute";

export const SLOTS: Record<Slot, { alt: string; hue: number; hint: string }> = {
  hero: { alt: "Une personne qui parle dans son téléphone, en souriant", hue: 150, hint: "Portrait chaleureux d'une personne parlant au téléphone, lumière naturelle" },
  lire: { alt: "Une femme qui lit à voix haute", hue: 28, hint: "Personne qui lit à voix haute ou enregistre sa voix" },
  traduire: { alt: "Deux personnes qui écrivent et échangent", hue: 42, hint: "Personnes qui écrivent ou discutent autour d'un texte" },
  valider: { alt: "Une personne qui écoute avec un casque", hue: 200, hint: "Personne qui écoute avec un casque ou un téléphone" },
  sante: { alt: "Une sage-femme qui parle à une femme enceinte au centre de santé", hue: 160, hint: "Consultation en centre de santé, échange avec une femme enceinte" },
  telephonie: { alt: "Un jeune homme qui utilise son téléphone dans la rue", hue: 12, hint: "Personne utilisant un téléphone mobile en Afrique de l'Ouest" },
  cinema: { alt: "Une famille qui regarde un film ensemble", hue: 270, hint: "Famille ou amis regardant un écran ensemble" },
  communaute: { alt: "Un groupe de personnes qui rient ensemble", hue: 38, hint: "Groupe de personnes souriantes, ambiance communautaire" },
};

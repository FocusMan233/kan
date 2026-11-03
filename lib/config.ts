// Configuration centrale de Kan. Modifier ici pour ajouter une langue ou ajuster les tarifs.

export type LangCode = "moore" | "dioula";

export const LANGUAGES: Record<
  LangCode,
  { label: string; native: string; hello: string; hue: number }
> = {
  moore: { label: "Mooré", native: "Mooré", hello: "Ne y yibeoogo", hue: 28 },
  dioula: { label: "Dioula", native: "Julakan", hello: "I ni ce", hue: 150 },
};

export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

export function isLang(v: unknown): v is LangCode {
  return typeof v === "string" && v in LANGUAGES;
}

// Tarifs en FCFA par tâche (versés une fois la contribution validée).
// Ajustables : le pilote sert justement à mesurer le coût réel par heure validée.
export const RATES = {
  read: 50,
  translate: 75,
  validate: 15,
} as const;

// Nombre d'avis concordants nécessaires pour valider ou rejeter une contribution.
export const VALIDATIONS_REQUIRED = 2;

// Nombre de lectures / traductions souhaitées par phrase.
export const TARGET_RECORDINGS_PER_TEXT = 3;
export const TARGET_TRANSLATIONS_PER_TEXT = 2;

// Contrôle qualité des enregistrements.
export const MIN_RECORDING_MS = 900;
export const MAX_RECORDING_MS = 30_000;
export const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

export const AGE_RANGES = ["18-25", "26-35", "36-45", "46-60", "60+"] as const;
export const GENDERS = ["Femme", "Homme", "Autre / ne souhaite pas préciser"] as const;
export const REGIONS = [
  "Centre (Ouagadougou)",
  "Hauts-Bassins (Bobo-Dioulasso)",
  "Cascades (Banfora)",
  "Boucle du Mouhoun",
  "Centre-Nord",
  "Centre-Est",
  "Centre-Ouest",
  "Centre-Sud",
  "Est",
  "Nord",
  "Plateau-Central",
  "Sahel",
  "Sud-Ouest",
  "Hors du Burkina Faso",
] as const;

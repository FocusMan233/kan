import crypto from "node:crypto";
import { one, run } from "@/lib/db";
import { AGE_RANGES, GENDERS, isLang, REGIONS } from "@/lib/config";
import { hashPin, json, normalizePhone, startSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return json({ error: "Requête invalide" }, 400);

  const name = String(b.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(b.phone ?? ""));
  const pin = String(b.pin ?? "");
  const langs = Array.isArray(b.langs) ? b.langs.filter(isLang) : [];

  if (name.length < 2) return json({ error: "Indique ton prénom" }, 400);
  if (phone.replace(/\D/g, "").length < 8) return json({ error: "Numéro de téléphone invalide" }, 400);
  if (!/^\d{4}$/.test(pin)) return json({ error: "Le code secret doit avoir 4 chiffres" }, 400);
  if (langs.length === 0) return json({ error: "Choisis au moins une langue" }, 400);
  if (b.consent !== true) return json({ error: "Le consentement est nécessaire pour participer" }, 400);
  if (one("SELECT 1 FROM users WHERE phone = ?", phone)) {
    return json({ error: "Ce numéro est déjà inscrit. Connecte-toi." }, 409);
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const pick = <T extends readonly string[]>(list: T, v: unknown) =>
    typeof v === "string" && (list as readonly string[]).includes(v) ? v : null;

  const { id } = run(
    `INSERT INTO users (name, phone, pin_hash, pin_salt, langs, dialect, region, age_range, gender, consent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    name,
    phone,
    hashPin(pin, salt),
    salt,
    JSON.stringify(langs),
    String(b.dialect ?? "").trim().slice(0, 80) || null,
    pick(REGIONS, b.region),
    pick(AGE_RANGES, b.age_range),
    pick(GENDERS, b.gender),
  );
  await startSession(id);
  return json({ ok: true });
}

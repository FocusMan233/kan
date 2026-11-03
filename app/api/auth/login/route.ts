import crypto from "node:crypto";
import { one } from "@/lib/db";
import { hashPin, json, normalizePhone, startSession } from "@/lib/session";

export const runtime = "nodejs";

// Limitation simple des essais par numéro (en mémoire) pour freiner le devinage du code à 4 chiffres.
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const phone = normalizePhone(String(b?.phone ?? ""));
  const pin = String(b?.pin ?? "");

  const a = attempts.get(phone);
  if (a && a.until > Date.now() && a.n >= 5) {
    return json({ error: "Trop d'essais. Réessaie dans quelques minutes." }, 429);
  }

  const u = one<{ id: number; pin_hash: string; pin_salt: string }>(
    "SELECT id, pin_hash, pin_salt FROM users WHERE phone = ?",
    phone,
  );
  const ok =
    u &&
    crypto.timingSafeEqual(Buffer.from(hashPin(pin, u.pin_salt)), Buffer.from(u.pin_hash));

  if (!ok) {
    const cur = a && a.until > Date.now() ? a : { n: 0, until: Date.now() + 10 * 60_000 };
    cur.n += 1;
    attempts.set(phone, cur);
    return json({ error: "Numéro ou code incorrect" }, 401);
  }
  attempts.delete(phone);
  await startSession(u.id);
  return json({ ok: true });
}

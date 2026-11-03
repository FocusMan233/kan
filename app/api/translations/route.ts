import { one } from "@/lib/db";
import { currentUser, json } from "@/lib/session";
import { isLang } from "@/lib/config";
import { addTranslation } from "@/lib/tasks";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ error: "Non connecté" }, 401);

  const b = await req.json().catch(() => null);
  const textId = Number(b?.textId);
  const language = b?.language;
  const content = String(b?.content ?? "").trim();

  if (!isLang(language) || !user.langs.includes(language)) return json({ error: "Langue invalide" }, 400);
  if (!one("SELECT 1 FROM texts WHERE id = ? AND active = 1", textId)) return json({ error: "Phrase introuvable" }, 404);
  if (content.length < 2) return json({ error: "Écris ta traduction" }, 400);
  if (content.length > 1000) return json({ error: "Traduction trop longue" }, 400);

  const id = addTranslation({ textId, userId: user.id, language, content });
  return json({ ok: true, id });
}

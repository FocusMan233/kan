import { currentUser, json } from "@/lib/session";
import { recordValidation } from "@/lib/tasks";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ error: "Non connecté" }, 401);

  const b = await req.json().catch(() => null);
  const kind = b?.kind;
  const itemId = Number(b?.itemId);
  if ((kind !== "recording" && kind !== "translation") || !Number.isInteger(itemId)) {
    return json({ error: "Requête invalide" }, 400);
  }
  try {
    const status = recordValidation(user.id, kind, itemId, b?.verdict === true);
    return json({ ok: true, status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    const dup = /UNIQUE/i.test(msg);
    return json({ error: dup ? "Tu as déjà donné ton avis" : msg }, dup ? 409 : 400);
  }
}

import { currentUser, json } from "@/lib/session";
import { isLang } from "@/lib/config";
import { nextReadTask, nextTranslateTask, nextValidateTask } from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return json({ error: "Non connecté" }, 401);

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const lang = url.searchParams.get("lang");

  if (type === "validate") {
    return json({ task: nextValidateTask(user.id, user.langs) });
  }
  if (!isLang(lang) || !user.langs.includes(lang)) {
    return json({ error: "Langue non disponible pour ton profil" }, 400);
  }
  if (type === "read") return json({ task: nextReadTask(user.id, lang) });
  if (type === "translate") return json({ task: nextTranslateTask(user.id, lang) });
  return json({ error: "Type de tâche inconnu" }, 400);
}

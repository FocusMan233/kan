import { currentUser, json } from "@/lib/session";
import { userStats } from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return json({ error: "Non connecté" }, 401);
  return json({ user: { name: user.name, langs: user.langs, region: user.region }, stats: userStats(user.id) });
}

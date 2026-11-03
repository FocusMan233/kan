import { run } from "@/lib/db";
import { isAdminRequest, json } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return json({ error: "Accès refusé" }, 401);
  const b = await req.json().catch(() => null);
  const category = String(b?.category ?? "").trim().toLowerCase().slice(0, 40) || "general";
  const lines: string[] = Array.isArray(b?.lines)
    ? b.lines
    : String(b?.lines ?? "").split(/\r?\n/);

  let added = 0;
  for (const raw of lines) {
    const content = String(raw).trim();
    if (content.length < 3 || content.length > 400) continue;
    added += run("INSERT OR IGNORE INTO texts (category, content) VALUES (?, ?)", category, content).changes;
  }
  return json({ ok: true, added });
}

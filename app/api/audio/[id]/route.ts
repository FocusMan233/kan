import fs from "node:fs";
import path from "node:path";
import { AUDIO_DIR, one } from "@/lib/db";
import { currentUser, isAdminRequest, json } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = isAdminRequest(req);
  const user = admin ? null : await currentUser();
  if (!admin && !user) return json({ error: "Non connecté" }, 401);

  const { id } = await params;
  const rec = one<{ file: string; mime: string; user_id: number; status: string; language: string }>(
    "SELECT file, mime, user_id, status, language FROM recordings WHERE id = ?",
    Number(id),
  );
  if (!rec) return json({ error: "Introuvable" }, 404);

  // Un contributeur n'écoute que ses enregistrements ou ceux à vérifier dans ses langues.
  if (user) {
    const mine = rec.user_id === user.id;
    const reviewable = rec.status === "pending" && user.langs.includes(rec.language as never);
    if (!mine && !reviewable) return json({ error: "Accès refusé" }, 403);
  }

  const buf = fs.readFileSync(path.join(AUDIO_DIR, rec.file));
  return new Response(buf, {
    headers: {
      "content-type": rec.mime,
      "content-length": String(buf.length),
      "cache-control": "private, max-age=3600",
    },
  });
}

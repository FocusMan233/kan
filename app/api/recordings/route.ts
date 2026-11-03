import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { AUDIO_DIR, one } from "@/lib/db";
import { currentUser, json } from "@/lib/session";
import { isLang, MAX_AUDIO_BYTES, MAX_RECORDING_MS, MIN_RECORDING_MS } from "@/lib/config";
import { addRecording } from "@/lib/tasks";

export const runtime = "nodejs";

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ error: "Non connecté" }, 401);

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Requête invalide" }, 400);

  const file = form.get("audio");
  const textId = Number(form.get("textId"));
  const language = form.get("language");
  const durationMs = Math.round(Number(form.get("durationMs")));

  if (!(file instanceof File)) return json({ error: "Audio manquant" }, 400);
  if (!isLang(language) || !user.langs.includes(language)) return json({ error: "Langue invalide" }, 400);
  if (!one("SELECT 1 FROM texts WHERE id = ? AND active = 1", textId)) return json({ error: "Phrase introuvable" }, 404);
  if (file.size > MAX_AUDIO_BYTES) return json({ error: "Enregistrement trop volumineux" }, 413);
  if (!Number.isFinite(durationMs) || durationMs < MIN_RECORDING_MS) {
    return json({ error: "Enregistrement trop court. Recommence en lisant toute la phrase." }, 400);
  }
  if (durationMs > MAX_RECORDING_MS) return json({ error: "Enregistrement trop long" }, 400);

  const mime = (file.type || "audio/webm").split(";")[0];
  const ext = EXT[mime];
  if (!ext) return json({ error: "Format audio non pris en charge" }, 415);

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(AUDIO_DIR, name), Buffer.from(await file.arrayBuffer()));

  try {
    const id = addRecording({ textId, userId: user.id, language, file: name, mime, durationMs });
    return json({ ok: true, id });
  } catch (e) {
    fs.rmSync(path.join(AUDIO_DIR, name), { force: true });
    throw e;
  }
}

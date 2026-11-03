import { all } from "@/lib/db";
import { isAdminRequest, json } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Export du corpus validé au format JSONL, prêt pour l'entraînement.
// ?type=recordings (par défaut) | translations    &token=... (ou en-tête x-admin-token)
export async function GET(req: Request) {
  if (!isAdminRequest(req)) return json({ error: "Accès refusé" }, 401);
  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "translations" ? "translations" : "recordings";
  const origin = url.origin;

  let lines: string[];
  if (type === "recordings") {
    const rows = all<Record<string, string | number | null>>(
      `SELECT r.id, r.language, r.duration_ms, r.file, t.content AS text_fr, t.category,
              u.gender, u.age_range, u.region, u.dialect
       FROM recordings r JOIN texts t ON t.id = r.text_id JOIN users u ON u.id = r.user_id
       WHERE r.status = 'validated' ORDER BY r.id`,
    );
    lines = rows.map((r) =>
      JSON.stringify({
        id: r.id,
        language: r.language,
        text_fr: r.text_fr,
        category: r.category,
        audio_url: `${origin}/api/audio/${r.id}`,
        file: r.file,
        duration_ms: r.duration_ms,
        speaker: { gender: r.gender, age_range: r.age_range, region: r.region, dialect: r.dialect },
      }),
    );
  } else {
    const rows = all<Record<string, string | number | null>>(
      `SELECT x.id, x.language, x.content AS translation, t.content AS text_fr, t.category,
              u.gender, u.age_range, u.region, u.dialect
       FROM translations x JOIN texts t ON t.id = x.text_id JOIN users u ON u.id = x.user_id
       WHERE x.status = 'validated' ORDER BY x.id`,
    );
    lines = rows.map((r) =>
      JSON.stringify({
        id: r.id,
        language: r.language,
        text_fr: r.text_fr,
        translation: r.translation,
        category: r.category,
        translator: { gender: r.gender, age_range: r.age_range, region: r.region, dialect: r.dialect },
      }),
    );
  }

  return new Response(lines.join("\n") + (lines.length ? "\n" : ""), {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="kan-${type}.jsonl"`,
    },
  });
}

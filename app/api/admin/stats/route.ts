import { all, one } from "@/lib/db";
import { isAdminRequest, json } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdminRequest(req)) return json({ error: "Accès refusé" }, 401);

  const perLang = all<{
    language: string;
    rec_total: number;
    rec_validated: number;
    rec_pending: number;
    hours_validated: number;
    tr_total: number;
    tr_validated: number;
  }>(
    `SELECT l.language,
       (SELECT COUNT(*) FROM recordings WHERE language = l.language) AS rec_total,
       (SELECT COUNT(*) FROM recordings WHERE language = l.language AND status = 'validated') AS rec_validated,
       (SELECT COUNT(*) FROM recordings WHERE language = l.language AND status = 'pending') AS rec_pending,
       (SELECT COALESCE(SUM(duration_ms),0) FROM recordings WHERE language = l.language AND status = 'validated') / 3600000.0 AS hours_validated,
       (SELECT COUNT(*) FROM translations WHERE language = l.language) AS tr_total,
       (SELECT COUNT(*) FROM translations WHERE language = l.language AND status = 'validated') AS tr_validated
     FROM (SELECT 'moore' AS language UNION SELECT 'dioula') l`,
  );

  const speakers = all<{ gender: string | null; n: number }>(
    "SELECT gender, COUNT(*) AS n FROM users GROUP BY gender",
  );
  const regions = all<{ region: string | null; n: number }>(
    "SELECT region, COUNT(*) AS n FROM users GROUP BY region ORDER BY n DESC",
  );
  const users = one<{ n: number }>("SELECT COUNT(*) AS n FROM users")!.n;
  const texts = one<{ n: number }>("SELECT COUNT(*) AS n FROM texts WHERE active = 1")!.n;

  const ledger = all<{ status: string; total: number }>(
    "SELECT status, COALESCE(SUM(amount),0) AS total FROM ledger GROUP BY status",
  );
  const g = (s: string) => ledger.find((l) => l.status === s)?.total ?? 0;

  // Coût par heure d'audio validée : dépenses liées aux enregistrements (hors annulées) / heures validées.
  const audioSpend = one<{ total: number }>(
    "SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE ref_kind = 'recording' AND status != 'void'",
  )!.total;
  const hours = perLang.reduce((s, l) => s + l.hours_validated, 0);

  return json({
    users,
    texts,
    perLang,
    speakers,
    regions,
    money: { earned: g("earned"), pending: g("pending"), paid: g("paid") },
    costPerValidatedHour: hours > 0 ? Math.round(audioSpend / hours) : null,
    hoursValidated: hours,
  });
}

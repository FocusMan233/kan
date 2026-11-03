import { all, one, run, db } from "./db";
import {
  LangCode,
  RATES,
  TARGET_RECORDINGS_PER_TEXT,
  TARGET_TRANSLATIONS_PER_TEXT,
  VALIDATIONS_REQUIRED,
} from "./config";

type Kind = "recording" | "translation";

export type ReadTask = { textId: number; text: string; category: string; language: LangCode };
export type TranslateTask = ReadTask;
export type ValidateTask =
  | {
      kind: "recording";
      id: number;
      language: LangCode;
      text: string;
      audioUrl: string;
    }
  | {
      kind: "translation";
      id: number;
      language: LangCode;
      text: string;
      translation: string;
    };

/** Prochaine phrase à lire : d'abord celles que la personne n'a pas encore lues et qui ont le moins de lectures. */
export function nextReadTask(userId: number, language: LangCode): ReadTask | null {
  const row = one<{ id: number; content: string; category: string }>(
    `SELECT t.id, t.content, t.category,
            (SELECT COUNT(*) FROM recordings r WHERE r.text_id = t.id AND r.language = ? AND r.status != 'rejected') AS n
     FROM texts t
     WHERE t.active = 1
       AND NOT EXISTS (SELECT 1 FROM recordings r WHERE r.text_id = t.id AND r.language = ? AND r.user_id = ?)
       AND (SELECT COUNT(*) FROM recordings r WHERE r.text_id = t.id AND r.language = ? AND r.status != 'rejected') < ?
     ORDER BY n ASC, RANDOM() LIMIT 1`,
    language,
    language,
    userId,
    language,
    TARGET_RECORDINGS_PER_TEXT,
  );
  return row ? { textId: row.id, text: row.content, category: row.category, language } : null;
}

export function nextTranslateTask(userId: number, language: LangCode): TranslateTask | null {
  const row = one<{ id: number; content: string; category: string }>(
    `SELECT t.id, t.content, t.category,
            (SELECT COUNT(*) FROM translations x WHERE x.text_id = t.id AND x.language = ? AND x.status != 'rejected') AS n
     FROM texts t
     WHERE t.active = 1
       AND NOT EXISTS (SELECT 1 FROM translations x WHERE x.text_id = t.id AND x.language = ? AND x.user_id = ?)
       AND (SELECT COUNT(*) FROM translations x WHERE x.text_id = t.id AND x.language = ? AND x.status != 'rejected') < ?
     ORDER BY n ASC, RANDOM() LIMIT 1`,
    language,
    language,
    userId,
    language,
    TARGET_TRANSLATIONS_PER_TEXT,
  );
  return row ? { textId: row.id, text: row.content, category: row.category, language } : null;
}

/** Prochaine contribution d'un autre à vérifier (audio ou traduction), dans les langues de la personne. */
export function nextValidateTask(userId: number, langs: LangCode[]): ValidateTask | null {
  if (langs.length === 0) return null;
  const marks = langs.map(() => "?").join(",");
  const rec = one<{ id: number; language: LangCode; content: string }>(
    `SELECT r.id, r.language, t.content
     FROM recordings r JOIN texts t ON t.id = r.text_id
     WHERE r.status = 'pending' AND r.user_id != ? AND r.language IN (${marks})
       AND NOT EXISTS (SELECT 1 FROM validations v WHERE v.kind = 'recording' AND v.item_id = r.id AND v.user_id = ?)
     ORDER BY (r.pos + r.neg) DESC, RANDOM() LIMIT 1`,
    userId,
    ...langs,
    userId,
  );
  const tr = one<{ id: number; language: LangCode; content: string; translation: string }>(
    `SELECT x.id, x.language, t.content, x.content AS translation
     FROM translations x JOIN texts t ON t.id = x.text_id
     WHERE x.status = 'pending' AND x.user_id != ? AND x.language IN (${marks})
       AND NOT EXISTS (SELECT 1 FROM validations v WHERE v.kind = 'translation' AND v.item_id = x.id AND v.user_id = ?)
     ORDER BY (x.pos + x.neg) DESC, RANDOM() LIMIT 1`,
    userId,
    ...langs,
    userId,
  );
  if (!rec && !tr) return null;
  const pickTranslation = rec && tr ? Math.random() < 0.4 : !!tr && !rec;
  if (pickTranslation && tr) {
    return { kind: "translation", id: tr.id, language: tr.language, text: tr.content, translation: tr.translation };
  }
  if (rec) {
    return { kind: "recording", id: rec.id, language: rec.language, text: rec.content, audioUrl: `/api/audio/${rec.id}` };
  }
  return null;
}

function table(kind: Kind) {
  return kind === "recording" ? "recordings" : "translations";
}

/** Enregistre un avis, met à jour le statut de la contribution et règle les gains concernés. */
export function recordValidation(userId: number, kind: Kind, itemId: number, verdict: boolean) {
  const d = db();
  d.exec("BEGIN");
  try {
    const item = one<{ id: number; user_id: number; status: string }>(
      `SELECT id, user_id, status FROM ${table(kind)} WHERE id = ?`,
      itemId,
    );
    if (!item) throw new Error("Contribution introuvable");
    if (item.user_id === userId) throw new Error("Tu ne peux pas valider ta propre contribution");
    if (item.status !== "pending") throw new Error("Cette contribution est déjà traitée");

    run("INSERT INTO validations (kind, item_id, user_id, verdict) VALUES (?, ?, ?, ?)", kind, itemId, userId, verdict ? 1 : 0);
    run("INSERT INTO ledger (user_id, task, ref_kind, ref_id, amount) VALUES (?, 'validate', ?, ?, ?)", userId, kind, itemId, RATES.validate);
    run(`UPDATE ${table(kind)} SET ${verdict ? "pos = pos + 1" : "neg = neg + 1"} WHERE id = ?`, itemId);

    const { pos, neg } = one<{ pos: number; neg: number }>(`SELECT pos, neg FROM ${table(kind)} WHERE id = ?`, itemId)!;
    let status = "pending";
    if (pos >= VALIDATIONS_REQUIRED && pos > neg) status = "validated";
    else if (neg >= VALIDATIONS_REQUIRED && neg > pos) status = "rejected";

    if (status !== "pending") {
      run(`UPDATE ${table(kind)} SET status = ? WHERE id = ?`, status, itemId);
      settle(kind, itemId, status === "validated");
    }
    d.exec("COMMIT");
    return status;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

function settle(kind: Kind, itemId: number, accepted: boolean) {
  // Auteur de la contribution : payé si validée, annulé si rejetée.
  const task = kind === "recording" ? "read" : "translate";
  run(
    "UPDATE ledger SET status = ? WHERE task = ? AND ref_kind = ? AND ref_id = ? AND status = 'pending'",
    accepted ? "earned" : "void",
    task,
    kind,
    itemId,
  );
  // Validateurs : payés s'ils sont d'accord avec le verdict final.
  const votes = all<{ user_id: number; verdict: number }>(
    "SELECT user_id, verdict FROM validations WHERE kind = ? AND item_id = ?",
    kind,
    itemId,
  );
  for (const v of votes) {
    const agrees = (v.verdict === 1) === accepted;
    run(
      "UPDATE ledger SET status = ? WHERE user_id = ? AND task = 'validate' AND ref_kind = ? AND ref_id = ? AND status = 'pending'",
      agrees ? "earned" : "void",
      v.user_id,
      kind,
      itemId,
    );
  }
}

export function addRecording(p: {
  textId: number;
  userId: number;
  language: LangCode;
  file: string;
  mime: string;
  durationMs: number;
}) {
  const { id } = run(
    "INSERT INTO recordings (text_id, user_id, language, file, mime, duration_ms) VALUES (?, ?, ?, ?, ?, ?)",
    p.textId,
    p.userId,
    p.language,
    p.file,
    p.mime,
    p.durationMs,
  );
  run("INSERT INTO ledger (user_id, task, ref_kind, ref_id, amount) VALUES (?, 'read', 'recording', ?, ?)", p.userId, id, RATES.read);
  return id;
}

export function addTranslation(p: { textId: number; userId: number; language: LangCode; content: string }) {
  const { id } = run(
    "INSERT INTO translations (text_id, user_id, language, content) VALUES (?, ?, ?, ?)",
    p.textId,
    p.userId,
    p.language,
    p.content,
  );
  run("INSERT INTO ledger (user_id, task, ref_kind, ref_id, amount) VALUES (?, 'translate', 'translation', ?, ?)", p.userId, id, RATES.translate);
  return id;
}

export function userStats(userId: number) {
  const money = all<{ status: string; total: number }>(
    "SELECT status, COALESCE(SUM(amount),0) AS total FROM ledger WHERE user_id = ? GROUP BY status",
    userId,
  );
  const get = (s: string) => money.find((m) => m.status === s)?.total ?? 0;
  const counts = one<{ rec: number; tr: number; val: number }>(
    `SELECT
       (SELECT COUNT(*) FROM recordings WHERE user_id = ?) AS rec,
       (SELECT COUNT(*) FROM translations WHERE user_id = ?) AS tr,
       (SELECT COUNT(*) FROM validations WHERE user_id = ?) AS val`,
    userId,
    userId,
    userId,
  )!;
  return {
    earned: get("earned"),
    pending: get("pending"),
    paid: get("paid"),
    recordings: counts.rec,
    translations: counts.tr,
    validations: counts.val,
  };
}

import { cookies } from "next/headers";
import crypto from "node:crypto";
import { one, run } from "./db";
import { isLang, LangCode } from "./config";

export type User = {
  id: number;
  name: string;
  phone: string;
  langs: LangCode[];
  dialect: string | null;
  region: string | null;
  age_range: string | null;
  gender: string | null;
};

const COOKIE = "kan_session";

export function hashPin(pin: string, salt: string) {
  return crypto.scryptSync(pin, salt, 32).toString("hex");
}

export function normalizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, "");
}

type Row = Omit<User, "langs"> & { langs: string };

function toUser(row: Row): User {
  let langs: LangCode[] = [];
  try {
    langs = (JSON.parse(row.langs) as string[]).filter(isLang);
  } catch {}
  return { ...row, langs };
}

export async function startSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  run("INSERT INTO sessions (token, user_id) VALUES (?, ?)", token, userId);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token = ?", token);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = one<Row>(
    `SELECT u.id, u.name, u.phone, u.langs, u.dialect, u.region, u.age_range, u.gender
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    token,
  );
  return row ? toUser(row) : null;
}

export function isAdminRequest(req: Request) {
  const expected = process.env.ADMIN_TOKEN || (process.env.NODE_ENV !== "production" ? "kan-admin" : "");
  if (!expected) return false;
  const url = new URL(req.url);
  const given = req.headers.get("x-admin-token") || url.searchParams.get("token") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

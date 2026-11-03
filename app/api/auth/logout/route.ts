import { endSession, json } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  await endSession();
  return json({ ok: true });
}

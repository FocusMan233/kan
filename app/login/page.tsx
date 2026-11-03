"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";

export default function Login() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { phone, pin } });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="container"><Logo /></div>
      </header>
      <div className="auth-wrap">
        <motion.form onSubmit={submit} className="card auth-card stack" style={{ gap: 18 }} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: "2rem" }}>Content de te revoir</h1>
          <div className="field">
            <label htmlFor="phone">Numéro de téléphone</label>
            <input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="pin">Code secret</label>
            <input id="pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Connexion…" : "Me connecter"}</button>
          <p className="center muted">Pas encore de compte ? <Link href="/join" style={{ fontWeight: 800, color: "var(--green)" }}>Participer</Link></p>
        </motion.form>
      </div>
    </>
  );
}

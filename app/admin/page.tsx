"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { CountUp } from "@/components/CountUp";
import { fcfa } from "@/lib/client";
import { LANGUAGES, LangCode } from "@/lib/config";

type Stats = {
  users: number;
  texts: number;
  hoursValidated: number;
  costPerValidatedHour: number | null;
  money: { earned: number; pending: number; paid: number };
  perLang: { language: LangCode; rec_total: number; rec_validated: number; rec_pending: number; hours_validated: number; tr_total: number; tr_validated: number }[];
  speakers: { gender: string | null; n: number }[];
  regions: { region: string | null; n: number }[];
};

const KEY = "kan:admin-token";

export default function Admin() {
  const [token, setToken] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState("");
  const [category, setCategory] = useState("sante");
  const [msg, setMsg] = useState<string | null>(null);

  const headers = useCallback((t: string) => ({ "x-admin-token": t }), []);

  const load = useCallback(
    async (t: string) => {
      setError(null);
      const res = await fetch("/api/admin/stats", { headers: headers(t) });
      if (!res.ok) {
        setStats(null);
        setError(res.status === 401 ? "Jeton invalide" : "Erreur de chargement");
        return;
      }
      setStats(await res.json());
      try { localStorage.setItem(KEY, t); } catch {}
    },
    [headers],
  );

  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t) { setToken(t); load(t); }
    } catch {}
  }, [load]);

  async function importTexts() {
    setMsg(null);
    const res = await fetch("/api/admin/texts", {
      method: "POST",
      headers: { ...headers(token), "content-type": "application/json" },
      body: JSON.stringify({ category, lines: lines.split(/\r?\n/) }),
    });
    const d = await res.json();
    if (res.ok) { setMsg(`${d.added} phrase(s) ajoutée(s)`); setLines(""); load(token); }
    else setMsg(d.error || "Erreur");
  }

  async function download(type: "recordings" | "translations") {
    const res = await fetch(`/api/admin/export?type=${type}`, { headers: headers(token) });
    if (!res.ok) return setMsg("Export impossible");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `kan-${type}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <header className="topbar">
        <div className="container"><Logo /><span className="chip chip-sun">Back-office</span></div>
      </header>
      <main className="container stack" style={{ padding: "32px 0 64px", gap: 24 }}>
        <form className="card row" onSubmit={(e) => { e.preventDefault(); load(token); }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="tok">Jeton d'accès</label>
            <input id="tok" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          </div>
          <button className="btn btn-primary" style={{ alignSelf: "end" }}>Se connecter</button>
          {error && <p className="error">{error}</p>}
        </form>

        {stats && (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
              <Stat label="Contributeurs" value={<CountUp value={stats.users} />} />
              <Stat label="Phrases sources" value={<CountUp value={stats.texts} />} />
              <Stat label="Heures validées" value={<>{stats.hoursValidated.toFixed(2)} h</>} />
              <Stat
                label="Coût par heure validée"
                value={stats.costPerValidatedHour === null ? "—" : fcfa(stats.costPerValidatedHour)}
                earn
              />
              <Stat label="Gains à payer" value={fcfa(stats.money.earned)} />
              <Stat label="En attente" value={fcfa(stats.money.pending)} />
            </div>

            <div className="card" style={{ overflowX: "auto" }}>
              <h2 style={{ fontSize: "1.4rem", marginBottom: 12 }}>Corpus par langue</h2>
              <table className="table">
                <thead>
                  <tr><th>Langue</th><th>Audios</th><th>Validés</th><th>À vérifier</th><th>Heures validées</th><th>Traductions</th><th>Validées</th></tr>
                </thead>
                <tbody>
                  {stats.perLang.map((l, i) => (
                    <motion.tr key={l.language} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                      <td><b>{LANGUAGES[l.language]?.label ?? l.language}</b></td>
                      <td>{l.rec_total}</td><td>{l.rec_validated}</td><td>{l.rec_pending}</td>
                      <td>{l.hours_validated.toFixed(2)} h</td><td>{l.tr_total}</td><td>{l.tr_validated}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row" style={{ alignItems: "stretch" }}>
              <div className="card" style={{ flex: 1, minWidth: 240 }}>
                <h3 style={{ marginBottom: 10 }}>Genre</h3>
                {stats.speakers.map((s) => <Bar key={s.gender ?? "nr"} label={s.gender ?? "Non renseigné"} n={s.n} max={stats.users} />)}
              </div>
              <div className="card" style={{ flex: 1, minWidth: 240 }}>
                <h3 style={{ marginBottom: 10 }}>Régions</h3>
                {stats.regions.map((s) => <Bar key={s.region ?? "nr"} label={s.region ?? "Non renseignée"} n={s.n} max={stats.users} />)}
              </div>
            </div>

            <div className="card stack">
              <h2 style={{ fontSize: "1.4rem" }}>Ajouter des phrases sources</h2>
              <p className="muted">Une phrase par ligne, en français. Les doublons sont ignorés.</p>
              <div className="field" style={{ maxWidth: 260 }}>
                <label htmlFor="cat">Catégorie</label>
                <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="sante">Santé</option>
                  <option value="telephonie">Téléphonie</option>
                  <option value="quotidien">Vie courante</option>
                  <option value="general">Autre</option>
                </select>
              </div>
              <div className="field"><textarea value={lines} onChange={(e) => setLines(e.target.value)} placeholder="Une phrase par ligne…" /></div>
              <div className="row">
                <button className="btn btn-primary" onClick={importTexts} disabled={!lines.trim()}>Importer</button>
                {msg && <span className="chip chip-green">{msg}</span>}
              </div>
            </div>

            <div className="card stack">
              <h2 style={{ fontSize: "1.4rem" }}>Exporter le corpus validé</h2>
              <p className="muted">Format JSONL, prêt pour l'entraînement. Les fichiers audio se récupèrent via le lien de chaque ligne.</p>
              <div className="row">
                <button className="btn btn-sun" onClick={() => download("recordings")}>⬇️ Audios validés</button>
                <button className="btn btn-sun" onClick={() => download("translations")}>⬇️ Traductions validées</button>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Stat({ label, value, earn }: { label: string; value: React.ReactNode; earn?: boolean }) {
  return (
    <div className={`stat${earn ? " earn" : ""}`}>
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}

function Bar({ label, n, max }: { label: string; n: number; max: number }) {
  const pct = max ? Math.round((n / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: "space-between", fontSize: ".9rem" }}><span>{label}</span><b>{n}</b></div>
      <div className="progress"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} /></div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useMe } from "@/components/Me";
import { Photo } from "@/components/Photo";
import { CountUp } from "@/components/CountUp";
import { useGuide } from "@/components/Voice";
import { fcfa } from "@/lib/client";
import { LANGUAGES, RATES } from "@/lib/config";

const ACTIONS = [
  { href: "/app/read", slot: "lire" as const, t: "Lire une phrase", d: "Enregistre ta voix", rate: RATES.read },
  { href: "/app/translate", slot: "traduire" as const, t: "Traduire une phrase", d: "Écris dans ta langue", rate: RATES.translate },
  { href: "/app/validate", slot: "valider" as const, t: "Écouter et valider", d: "Dis si c'est juste", rate: RATES.validate },
];

export default function Dashboard() {
  const { me, lang } = useMe();
  useGuide(me ? `Bonjour ${me.user.name}. Que veux-tu faire ? Lire une phrase, traduire, ou écouter les autres.` : null);

  if (!me) return <div className="skeleton" style={{ height: 280 }} />;
  const s = me.stats;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 style={{ fontSize: "2.1rem" }}>Bonjour {me.user.name} 👋</h1>
        {lang && <p className="muted" style={{ marginTop: 6 }}>{LANGUAGES[lang].hello} ! Tu contribues en {LANGUAGES[lang].label}.</p>}
      </div>

      <div className="stat-grid">
        <motion.div className="stat earn" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <b><CountUp value={s.earned} format={(n) => fcfa(Math.round(n))} /></b>
          <small>gagnés</small>
        </motion.div>
        <motion.div className="stat" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.08 }}>
          <b><CountUp value={s.pending} format={(n) => fcfa(Math.round(n))} /></b>
          <small>en attente de validation</small>
        </motion.div>
        <motion.div className="stat" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.16 }}>
          <b><CountUp value={s.recordings + s.translations + s.validations} /></b>
          <small>contributions</small>
        </motion.div>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        {ACTIONS.map((a, i) => (
          <motion.div key={a.href} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
            <Link href={a.href} className="action-card">
              <Photo slot={a.slot} />
              <div>
                <h3>{a.t}</h3>
                <p className="muted">{a.d}</p>
                <span className="chip chip-green" style={{ marginTop: 8 }}>+ {fcfa(a.rate)}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

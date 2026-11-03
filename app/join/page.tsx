"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { useGuide, VoiceToggle } from "@/components/Voice";
import { AGE_RANGES, GENDERS, LANGUAGES, LANG_CODES, LangCode, REGIONS } from "@/lib/config";
import { api } from "@/lib/client";

const GUIDE = [
  "Dans quelle langue veux-tu participer ? Choisis le mooré, le dioula, ou les deux.",
  "Parle-nous un peu de toi. Ces informations nous aident à avoir des voix de toutes les régions.",
  "Dernière étape. Choisis un code secret à quatre chiffres, et lis bien la case de consentement.",
];

export default function Join() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [langs, setLangs] = useState<LangCode[]>([]);
  const [f, setF] = useState({ name: "", dialect: "", region: "", age_range: "", gender: "", phone: "", pin: "" });
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useGuide(GUIDE[step]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  function next() {
    setError(null);
    if (step === 0 && langs.length === 0) return setError("Choisis au moins une langue");
    if (step === 1 && f.name.trim().length < 2) return setError("Indique ton prénom");
    setStep((s) => s + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!adult) return setError("Kan est réservé aux personnes de 18 ans et plus");
    if (!consent) return setError("Le consentement est nécessaire pour participer");
    setBusy(true);
    try {
      await api("/api/auth/register", { method: "POST", json: { ...f, langs, consent } });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="container">
          <Logo />
          <VoiceToggle />
        </div>
      </header>
      <div className="auth-wrap">
        <motion.div className="card auth-card stack" style={{ gap: 22 }} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <div className="progress" aria-hidden="true">
            <motion.div animate={{ width: `${((step + 1) / 3) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>

          <form onSubmit={submit} className="stack" style={{ gap: 22 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.28 }} className="stack" style={{ gap: 18 }}>
                {step === 0 && (
                  <>
                    <h1 style={{ fontSize: "2rem" }}>Quelle langue parles-tu ?</h1>
                    <p className="muted">Tu peux en choisir plusieurs.</p>
                    <div className="lang-pick">
                      {LANG_CODES.map((c) => (
                        <button
                          type="button"
                          key={c}
                          className="lang-option"
                          aria-pressed={langs.includes(c)}
                          onClick={() => setLangs((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))}
                        >
                          <strong>{LANGUAGES[c].label}</strong>
                          <span>{LANGUAGES[c].hello}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h1 style={{ fontSize: "2rem" }}>Parle-nous de toi</h1>
                    <div className="field">
                      <label htmlFor="name">Ton prénom</label>
                      <input id="name" value={f.name} onChange={set("name")} autoComplete="given-name" />
                    </div>
                    <div className="field">
                      <label htmlFor="region">Ta région</label>
                      <select id="region" value={f.region} onChange={set("region")}>
                        <option value="">Choisir…</option>
                        {REGIONS.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="dialect">Ta façon de parler (village, ville, variante)</label>
                      <input id="dialect" value={f.dialect} onChange={set("dialect")} placeholder="Ex. : parler de Koudougou" />
                    </div>
                    <div className="row" style={{ alignItems: "stretch" }}>
                      <div className="field" style={{ flex: 1, minWidth: 140 }}>
                        <label htmlFor="age">Âge</label>
                        <select id="age" value={f.age_range} onChange={set("age_range")}>
                          <option value="">Choisir…</option>
                          {AGE_RANGES.map((a) => <option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <div className="field" style={{ flex: 1, minWidth: 140 }}>
                        <label htmlFor="gender">Genre</label>
                        <select id="gender" value={f.gender} onChange={set("gender")}>
                          <option value="">Choisir…</option>
                          {GENDERS.map((g) => <option key={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h1 style={{ fontSize: "2rem" }}>Ton compte</h1>
                    <div className="field">
                      <label htmlFor="phone">Numéro de téléphone (Mobile Money)</label>
                      <input id="phone" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="+226 70 00 00 00" autoComplete="tel" />
                    </div>
                    <div className="field">
                      <label htmlFor="pin">Code secret à 4 chiffres</label>
                      <input id="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} value={f.pin} onChange={set("pin")} autoComplete="new-password" />
                    </div>
                    <label className="checkbox">
                      <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                      <span>J'ai 18 ans ou plus.</span>
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      <span>
                        J'accepte que mes enregistrements et mes traductions soient utilisés par Kan pour construire des outils dans les
                        langues du Burkina Faso (santé, téléphone, traduction). Mon nom et mon numéro ne sont jamais partagés. Je peux
                        demander la suppression de mes contributions.
                      </span>
                    </label>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {error && <p className="error" role="alert">{error}</p>}

            <div className="row" style={{ justifyContent: "space-between" }}>
              {step > 0 ? (
                <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>← Retour</button>
              ) : (
                <Link href="/login" className="btn btn-ghost">J'ai déjà un compte</Link>
              )}
              {step < 2 ? (
                <button type="button" className="btn btn-primary" onClick={next}>Continuer →</button>
              ) : (
                <button type="submit" className="btn btn-sun btn-lg" disabled={busy}>{busy ? "Création…" : "Créer mon compte"}</button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </>
  );
}

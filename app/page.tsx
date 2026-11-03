"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Photo } from "@/components/Photo";
import { Reveal } from "@/components/Reveal";
import { Waves } from "@/components/Waves";
import { SpeakButton, VoiceToggle } from "@/components/Voice";

const INTRO =
  "Bienvenue sur Kan. Ici, ta langue a une voix. Lis une phrase, traduis-la, écoute les autres, et sois rémunéré pour chaque contribution validée.";

const GREETINGS = ["Ne y yibeoogo", "I ni ce", "Bonjour", "Bienvenue", "Ne y windga", "I ni sogoma", "Merci", "Barka"];

export default function Home() {
  const reduce = useReducedMotion();
  const float = (d: number, y = 10) =>
    reduce ? {} : { animate: { y: [0, -y, 0] }, transition: { duration: 5 + d, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <>
      <header className="topbar">
        <div className="container">
          <Logo />
          <div className="row" style={{ gap: 8 }}>
            <VoiceToggle />
            <Link href="/login" className="btn btn-ghost hidden-sm">Se connecter</Link>
            <Link href="/join" className="btn btn-primary">Participer</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <motion.span className="chip chip-sun" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                ✺ Mooré · Dioula · bientôt d'autres langues
              </motion.span>
              <motion.h1
                style={{ marginTop: 18 }}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                Ta langue a une <em>voix.</em>
              </motion.h1>
              <motion.p className="lead" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}>
                Prête ta voix à Kan. Lis, traduis, écoute : chaque contribution validée est rémunérée.
              </motion.p>
              <motion.div className="row" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.8 }}>
                <Link href="/join" className="btn btn-sun btn-lg">Je participe</Link>
                <SpeakButton text={INTRO} label="Écouter la présentation" className="btn btn-ghost btn-lg" />
              </motion.div>
              <motion.div style={{ marginTop: 36, color: "var(--green)", maxWidth: 380 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
                <Waves bars={34} />
              </motion.div>
            </div>

            <motion.div
              className="hero-visual"
              initial={{ opacity: 0, scale: 0.94, rotate: 1.5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <Photo slot="hero" className="" priority style={{ position: "absolute", inset: 0, borderRadius: "36px 36px 120px 36px", overflow: "hidden", boxShadow: "var(--shadow-lg)" }} />
              <motion.div className="float-chip" style={{ left: -18, top: "14%" }} {...float(0)}>
                <span className="dot" style={{ background: "var(--green-3)" }} />
                <div>Mooré<small>Ne y yibeoogo</small></div>
              </motion.div>
              <motion.div className="float-chip" style={{ right: -14, top: "46%" }} {...float(1, 14)}>
                <span className="dot" style={{ background: "var(--sun)" }} />
                <div>Dioula<small>I ni ce</small></div>
              </motion.div>
              <motion.div className="float-chip" style={{ left: "10%", bottom: -18, color: "var(--green)" }} {...float(2)}>
                <div style={{ width: 120 }}><Waves bars={16} height={34} /></div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...GREETINGS, ...GREETINGS].map((g, i) => <span key={i}>{g}</span>)}
          </div>
        </div>

        <section className="section">
          <div className="container">
            <Reveal>
              <p className="eyebrow">Comment ça marche</p>
              <h2>Trois gestes, depuis ton téléphone.</h2>
            </Reveal>
            <div className="steps">
              {[
                { n: 1, icon: "🎙️", bg: "rgba(196,65,43,.12)", t: "Lis", d: "Une phrase s'affiche. Lis-la à voix haute dans ta langue, comme tu parles chez toi." },
                { n: 2, icon: "✍️", bg: "rgba(244,180,26,.25)", t: "Traduis", d: "On te propose une phrase en français. Écris-la dans ta langue, avec tes mots." },
                { n: 3, icon: "👂", bg: "rgba(14,90,58,.12)", t: "Écoute et valide", d: "Écoute les autres, dis si c'est juste. Ton avis aide à garder le meilleur." },
              ].map((s, i) => (
                <Reveal key={s.n} delay={i * 0.12}>
                  <motion.div className="card step" whileHover={reduce ? undefined : { y: -6 }} style={{ height: "100%" }}>
                    <span className="num">{s.n}</span>
                    <div className="icon" style={{ background: s.bg }}>{s.icon}</div>
                    <h3 style={{ fontSize: "1.5rem", marginBottom: 8 }}>{s.t}</h3>
                    <p className="muted">{s.d}</p>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section" style={{ background: "var(--cream-2)" }}>
          <div className="container">
            <Reveal>
              <p className="eyebrow">Pour quoi faire</p>
              <h2>Des voix qui servent tout le monde.</h2>
              <p className="muted" style={{ marginTop: 14, maxWidth: "52ch", fontSize: "1.1rem" }}>
                Ce que tu enregistres aide à parler à chacun dans sa langue, là où ça compte.
              </p>
            </Reveal>
            <div className="uses">
              {[
                { slot: "sante" as const, t: "Santé", d: "Des messages de prévention compris par toutes les familles, dans les centres de santé." },
                { slot: "telephonie" as const, t: "Téléphone", d: "Un assistant qui répond en mooré ou en dioula, pour consulter son solde ou acheter un forfait." },
                { slot: "cinema" as const, t: "Films et culture", d: "Des films et des vidéos à regarder en famille dans sa langue." },
              ].map((u, i) => (
                <Reveal key={u.t} delay={i * 0.12}>
                  <div className="use">
                    <Photo slot={u.slot} />
                    <div className="body">
                      <h3>{u.t}</h3>
                      <p className="muted">{u.d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 48, alignItems: "center" }}>
            <Reveal>
              <Photo slot="communaute" style={{ aspectRatio: "4/3", borderRadius: 36, overflow: "hidden", boxShadow: "var(--shadow-lg)" }} />
            </Reveal>
            <Reveal delay={0.15}>
              <p className="eyebrow">Ta contribution compte</p>
              <h2>Chaque voix est payée, chaque voix est respectée.</h2>
              <ul className="stack muted" style={{ listStyle: "none", padding: 0, margin: "22px 0 28px", fontSize: "1.08rem" }}>
                <li>💸 Tu es rémunéré pour chaque contribution validée, par Mobile Money.</li>
                <li>🔒 Ton nom et ton numéro ne sont jamais partagés.</li>
                <li>📱 Ça marche sur un simple téléphone, même avec peu de connexion.</li>
                <li>🌍 Tu fais vivre ta langue pour les générations qui viennent.</li>
              </ul>
              <Link href="/join" className="btn btn-primary btn-lg">Rejoindre Kan</Link>
            </Reveal>
          </div>
        </section>

        <section className="dark cta-band">
          <div style={{ position: "absolute", inset: 0, opacity: 0.18, color: "var(--sun)", display: "grid", alignContent: "center" }} aria-hidden="true">
            <Waves bars={90} height={220} />
          </div>
          <div className="container" style={{ position: "relative" }}>
            <Reveal>
              <h2 style={{ fontSize: "clamp(2.2rem,5vw,3.8rem)", fontWeight: 900 }}>Dis quelque chose dans ta langue.</h2>
              <p className="muted" style={{ margin: "16px auto 28px", maxWidth: "40ch", fontSize: "1.15rem" }}>
                Une phrase suffit pour commencer.
              </p>
              <Link href="/join" className="btn btn-sun btn-lg">Commencer maintenant</Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container row" style={{ justifyContent: "space-between" }}>
          <Logo />
          <span>© {new Date().getFullYear()} Kan · La voix de nos langues</span>
        </div>
      </footer>
    </>
  );
}

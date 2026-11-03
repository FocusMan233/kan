"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { MeProvider, useMe } from "@/components/Me";
import { VoiceToggle } from "@/components/Voice";
import { LANGUAGES } from "@/lib/config";
import { api, fcfa } from "@/lib/client";

const NAV = [
  { href: "/app", ico: "🏠", lbl: "Accueil" },
  { href: "/app/read", ico: "🎙️", lbl: "Lire" },
  { href: "/app/translate", ico: "✍️", lbl: "Traduire" },
  { href: "/app/validate", ico: "👂", lbl: "Écouter" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { me, lang, setLang } = useMe();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/");
  }

  return (
    <div className="app-shell">
      <header className="app-head">
        <div className="container">
          <Logo href="/app" />
          <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
            {me && me.user.langs.length > 1 && lang && (
              <div className="row" style={{ gap: 4 }} role="group" aria-label="Langue">
                {me.user.langs.map((l) => (
                  <button
                    key={l}
                    className={`chip ${l === lang ? "chip-green" : ""}`}
                    onClick={() => setLang(l)}
                    aria-pressed={l === lang}
                    style={l === lang ? { outline: "2px solid var(--green)" } : undefined}
                  >
                    {LANGUAGES[l].label}
                  </button>
                ))}
              </div>
            )}
            {me && <span className="chip chip-sun hidden-sm">{fcfa(me.stats.earned)}</span>}
            <VoiceToggle />
            <button className="chip" onClick={logout} title="Se déconnecter" aria-label="Se déconnecter">⎋</button>
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav" aria-label="Navigation principale">
        {NAV.map((n) => {
          const active = n.href === "/app" ? path === "/app" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="ico" aria-hidden="true">{n.ico}</span>
              <span className="lbl">{n.lbl}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MeProvider>
      <Shell>{children}</Shell>
    </MeProvider>
  );
}

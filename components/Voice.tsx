"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type SpeakOpts = {
  /** Clé d'un enregistrement dans /public/voice/<lang>/<key>.mp3 (voix humaine, prioritaire). */
  key?: string;
  /** Langue du pack vocal ("moore", "dioula"). */
  lang?: string;
  /** Parler même si la voix guide est désactivée (bouton « Écouter »). */
  force?: boolean;
};

type Ctx = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  speaking: boolean;
  speak: (text: string, o?: SpeakOpts) => void;
  stop: () => void;
};

const VoiceCtx = createContext<Ctx | null>(null);
const STORE = "kan:voice";

/**
 * Voix de la plateforme.
 * 1) Si un enregistrement humain existe (/voice/<lang>/<key>.mp3), il est joué : c'est ainsi que Kan parlera mooré et dioula,
 *    avec les voix des locuteurs partenaires.
 * 2) Sinon, repli sur la synthèse vocale du navigateur en français.
 */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORE) === "off") setEnabledState(false);
    } catch {}
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const tts = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 0.95;
    const fr = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
    if (fr) u.voice = fr;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    (text: string, o: SpeakOpts = {}) => {
      if (!enabled && !o.force) return;
      stop();
      setSpeaking(true);
      if (o.key && o.lang) {
        const a = new Audio(`/voice/${o.lang}/${o.key}.mp3`);
        audioRef.current = a;
        a.onended = () => setSpeaking(false);
        a.onerror = () => tts(text);
        a.play().catch(() => tts(text));
      } else {
        tts(text);
      }
    },
    [enabled, stop, tts],
  );

  const setEnabled = useCallback(
    (v: boolean) => {
      setEnabledState(v);
      try {
        localStorage.setItem(STORE, v ? "on" : "off");
      } catch {}
      if (!v) stop();
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return <VoiceCtx.Provider value={{ enabled, setEnabled, speaking, speak, stop }}>{children}</VoiceCtx.Provider>;
}

export function useVoice() {
  const c = useContext(VoiceCtx);
  if (!c) throw new Error("useVoice doit être utilisé dans <VoiceProvider>");
  return c;
}

/** Interrupteur de la voix guide. */
export function VoiceToggle() {
  const { enabled, setEnabled, speaking } = useVoice();
  return (
    <button
      type="button"
      className="voice-toggle"
      aria-pressed={enabled}
      onClick={() => setEnabled(!enabled)}
      title={enabled ? "Couper la voix" : "Activer la voix"}
    >
      <span aria-hidden="true">{enabled ? (speaking ? "🔊" : "🔉") : "🔇"}</span>
      <span className="hidden-sm">{enabled ? "Voix activée" : "Voix coupée"}</span>
    </button>
  );
}

/** Bouton « Écouter » : lit un texte à voix haute. */
export function SpeakButton({
  text,
  label = "Écouter",
  soundKey,
  lang,
  className = "btn btn-ghost",
}: {
  text: string;
  label?: string;
  soundKey?: string;
  lang?: string;
  className?: string;
}) {
  const { speak, speaking } = useVoice();
  return (
    <button type="button" className={className} onClick={() => speak(text, { key: soundKey, lang, force: true })} aria-live="polite">
      <span aria-hidden="true">{speaking ? "🔊" : "▶️"}</span> {label}
    </button>
  );
}

/** Lit automatiquement un message guide quand la page s'affiche (si la voix est activée). */
export function useGuide(text: string | null, key?: string, lang?: string) {
  const { speak, enabled } = useVoice();
  useEffect(() => {
    if (!text || !enabled) return;
    const t = setTimeout(() => speak(text, { key, lang }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enabled]);
}

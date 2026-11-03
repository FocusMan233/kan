"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MAX_RECORDING_MS, MIN_RECORDING_MS } from "@/lib/config";

type State = "idle" | "recording" | "review";
const BARS = 28;
const MIN_PEAK = 0.05; // en dessous, on considère l'enregistrement trop silencieux

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export function Recorder({
  onSubmit,
  busy,
}: {
  onSubmit: (blob: Blob, durationMs: number) => Promise<void>;
  busy: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; ms: number; peak: number } | null>(null);
  const [playing, setPlaying] = useState(false);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const peak = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const audioRef = useRef<HTMLAudioElement>(null);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(timer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  useEffect(
    () => () => {
      cleanup();
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    },
    [cleanup],
  );

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Ton navigateur ne permet pas d'enregistrer. Essaie avec Chrome ou Safari à jour.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      streamRef.current = stream;

      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = rec;
      chunks.current = [];
      peak.current = 0;
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = () => {
        const ms = Date.now() - startedAt.current;
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        cleanup();
        setResult({ blob, url: URL.createObjectURL(blob), ms, peak: peak.current });
        setState("review");
      };

      // Niveau sonore en direct (ondes qui suivent la voix)
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = 0;
      const tick = (t: number) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / data.length);
        peak.current = Math.max(peak.current, rms);
        if (t - last > 55) {
          last = t;
          setLevels((l) => [...l.slice(1), Math.min(1, rms * 5)]);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      startedAt.current = Date.now();
      rec.start(250);
      setState("recording");
      timer.current = setTimeout(stop, MAX_RECORDING_MS);
    } catch {
      cleanup();
      setError("Impossible d'utiliser le micro. Autorise-le dans ton navigateur puis réessaie.");
    }
  }

  function stop() {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }

  function reset() {
    setResult(null);
    setLevels(Array(BARS).fill(0));
    setPlaying(false);
    setState("idle");
  }

  const tooShort = !!result && result.ms < MIN_RECORDING_MS;
  const tooQuiet = !!result && result.peak < MIN_PEAK;
  const problem = tooShort
    ? "C'est trop court. Lis toute la phrase, puis recommence."
    : tooQuiet
      ? "On t'entend à peine. Rapproche-toi du téléphone et recommence."
      : null;

  return (
    <div className="stack" style={{ justifyItems: "center", textAlign: "center" }}>
      <div className="level-bars" aria-hidden="true">
        {levels.map((v, i) => (
          <span key={i} style={{ height: `${Math.max(6, v * 100)}%`, opacity: state === "recording" ? 1 : 0.35 }} />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {state === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="stack" style={{ justifyItems: "center" }}>
            <button className="rec-btn" onClick={start} aria-label="Commencer l'enregistrement">🎙️</button>
            <p className="muted">Appuie, puis lis la phrase à voix haute</p>
          </motion.div>
        )}
        {state === "recording" && (
          <motion.div key="rec" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="stack" style={{ justifyItems: "center" }}>
            <button className="rec-btn live" onClick={stop} aria-label="Arrêter l'enregistrement">⏹️</button>
            <p style={{ fontWeight: 700 }}>Je t'écoute… appuie quand tu as fini</p>
          </motion.div>
        )}
        {state === "review" && result && (
          <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="stack" style={{ width: "100%" }}>
            <audio ref={audioRef} src={result.url} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
            <button
              className="btn btn-ghost btn-lg"
              onClick={() => (playing ? audioRef.current?.pause() : audioRef.current?.play())}
            >
              {playing ? "⏸️ Pause" : "▶️ Réécouter"}
            </button>
            {problem && <p className="error" role="alert">{problem}</p>}
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn btn-ghost" onClick={reset} disabled={busy}>🔁 Recommencer</button>
              <button
                className="btn btn-primary btn-lg"
                disabled={busy || !!problem}
                onClick={() => onSubmit(result.blob, result.ms).then(reset).catch(() => {})}
              >
                {busy ? "Envoi…" : "✅ Envoyer"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

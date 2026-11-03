"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMe } from "@/components/Me";
import { Photo } from "@/components/Photo";
import { SpeakButton, useGuide } from "@/components/Voice";
import { Waves } from "@/components/Waves";
import { EmptyTask, TaskSkeleton, Toast } from "@/components/TaskUI";
import { useTask } from "@/components/useTask";
import { api, fcfa } from "@/lib/client";
import { LANGUAGES, RATES } from "@/lib/config";

type Task =
  | { kind: "recording"; id: number; language: "moore" | "dioula"; text: string; audioUrl: string }
  | { kind: "translation"; id: number; language: "moore" | "dioula"; text: string; translation: string };

export default function ValidatePage() {
  const { lang, refresh } = useMe();
  const { task, loading, error, reload } = useTask<Task>("validate", lang);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => { setHeard(false); setPlaying(false); }, [task?.kind, task?.id]);

  useGuide(
    task
      ? task.kind === "recording"
        ? `Écoute cet enregistrement en ${LANGUAGES[task.language].label}. La personne lit-elle bien la phrase ?`
        : `Lis cette traduction en ${LANGUAGES[task.language].label}. Est-elle juste ?`
      : null,
  );

  async function vote(verdict: boolean) {
    if (!task) return;
    setBusy(true);
    setErr(null);
    try {
      await api("/api/validations", { method: "POST", json: { kind: task.kind, itemId: task.id, verdict } });
      setToast(true);
      setTimeout(() => setToast(false), 1800);
      await Promise.all([refresh(), reload()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !task) return <TaskSkeleton />;
  if (error) return <p className="error">{error}</p>;
  if (!task) return <EmptyTask message="Rien à vérifier pour l'instant. Reviens quand d'autres personnes auront contribué." />;

  const canVote = task.kind === "translation" || heard;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Photo slot="valider" className="task-photo" />
      <AnimatePresence mode="wait">
        <motion.div key={`${task.kind}-${task.id}`} className="card stack" style={{ gap: 18 }} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="chip chip-green">
              {task.kind === "recording" ? "Écouter" : "Relire"} · {LANGUAGES[task.language].label}
            </span>
            <span className="chip chip-sun">+ {fcfa(RATES.validate)}</span>
          </div>

          <div>
            <p className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>Phrase en français</p>
            <p className="task-text" style={{ fontSize: "1.45rem" }}>{task.text}</p>
          </div>

          {task.kind === "recording" ? (
            <div className="stack" style={{ justifyItems: "center", gap: 12 }}>
              <audio
                ref={audio}
                src={task.audioUrl}
                preload="auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => { setPlaying(false); setHeard(true); }}
              />
              <div style={{ color: "var(--green)", width: "100%" }}><Waves bars={36} idle={!playing} /></div>
              <button className="btn btn-sun btn-lg" onClick={() => (playing ? audio.current?.pause() : audio.current?.play())}>
                {playing ? "⏸️ Pause" : heard ? "🔁 Réécouter" : "▶️ Écouter la voix"}
              </button>
              {!heard && <p className="muted">Écoute jusqu'au bout pour donner ton avis.</p>}
            </div>
          ) : (
            <div>
              <p className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>Traduction en {LANGUAGES[task.language].label}</p>
              <p className="task-text" style={{ color: "var(--green)" }}>{task.translation}</p>
            </div>
          )}

          <p style={{ fontWeight: 800, fontSize: "1.1rem" }}>
            {task.kind === "recording" ? "La personne a-t-elle bien lu la phrase ?" : "Cette traduction est-elle juste ?"}
          </p>
          <div className="verdict">
            <button className="btn btn-primary" onClick={() => vote(true)} disabled={busy || !canVote}>👍 Oui, c'est juste</button>
            <button className="btn btn-danger" onClick={() => vote(false)} disabled={busy || !canVote}>👎 Non</button>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            {task.kind === "recording" && <SpeakButton text={task.text} label="Écouter la phrase" />}
            <button className="btn btn-ghost" onClick={reload} disabled={busy}>Passer ⏭️</button>
          </div>
          {err && <p className="error" role="alert">{err}</p>}
        </motion.div>
      </AnimatePresence>
      <Toast show={toast}>👍 Merci pour ton avis !</Toast>
    </div>
  );
}

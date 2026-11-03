"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMe } from "@/components/Me";
import { Photo } from "@/components/Photo";
import { Recorder } from "@/components/Recorder";
import { SpeakButton, useGuide } from "@/components/Voice";
import { EmptyTask, TaskSkeleton, Toast } from "@/components/TaskUI";
import { useTask } from "@/components/useTask";
import { api, fcfa } from "@/lib/client";
import { LANGUAGES, RATES } from "@/lib/config";

type Task = { textId: number; text: string; category: string; language: "moore" | "dioula" };

export default function ReadPage() {
  const { lang, refresh } = useMe();
  const { task, loading, error, reload } = useTask<Task>("read", lang);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useGuide(
    task && lang
      ? `Lis cette phrase à voix haute en ${LANGUAGES[lang].label}. Dis-la comme tu la dirais chez toi. Phrase : ${task.text}`
      : null,
  );

  async function send(blob: Blob, durationMs: number) {
    if (!task) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("audio", blob, "voice");
      fd.set("textId", String(task.textId));
      fd.set("language", task.language);
      fd.set("durationMs", String(durationMs));
      await api("/api/recordings", { method: "POST", body: fd });
      setToast(true);
      setTimeout(() => setToast(false), 2200);
      await Promise.all([refresh(), reload()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  if (loading && !task) return <TaskSkeleton />;
  if (error) return <p className="error">{error}</p>;
  if (!task) return <EmptyTask message="Il n'y a plus de phrases à lire pour l'instant. Reviens bientôt, ou essaie d'écouter et valider." />;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Photo slot="lire" className="task-photo" />
      <AnimatePresence mode="wait">
        <motion.div key={task.textId} className="card stack" style={{ gap: 18 }} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="chip chip-green">Lis en {LANGUAGES[task.language].label}</span>
            <span className="chip chip-sun">+ {fcfa(RATES.read)}</span>
          </div>
          <p className="task-text">{task.text}</p>
          <div className="row">
            <SpeakButton text={task.text} label="Écouter la phrase" />
            <button className="btn btn-ghost" onClick={reload} disabled={busy}>Passer ⏭️</button>
          </div>
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
          <Recorder key={task.textId} onSubmit={send} busy={busy} />
          {err && <p className="error" role="alert">{err}</p>}
        </motion.div>
      </AnimatePresence>
      <Toast show={toast}>🎉 Merci ! +{fcfa(RATES.read)} en attente de validation</Toast>
    </div>
  );
}

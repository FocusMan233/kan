"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMe } from "@/components/Me";
import { Photo } from "@/components/Photo";
import { SpeakButton, useGuide } from "@/components/Voice";
import { EmptyTask, TaskSkeleton, Toast } from "@/components/TaskUI";
import { useTask } from "@/components/useTask";
import { api, fcfa } from "@/lib/client";
import { LANGUAGES, RATES } from "@/lib/config";

type Task = { textId: number; text: string; category: string; language: "moore" | "dioula" };

// Lettres spéciales proposées à la saisie. À faire valider par le coordinateur de chaque langue.
const SPECIAL: Record<string, string[]> = {
  moore: ["ɛ", "ɩ", "ʋ", "ã", "ĩ", "ũ"],
  dioula: ["ɛ", "ɔ", "ɲ", "ŋ"],
};

export default function TranslatePage() {
  const { lang, refresh } = useMe();
  const { task, loading, error, reload } = useTask<Task>("translate", lang);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useGuide(
    task && lang
      ? `Écris cette phrase en ${LANGUAGES[lang].label}, avec tes mots. Phrase : ${task.text}`
      : null,
  );

  function insert(ch: string) {
    const el = area.current;
    if (!el) return setValue((v) => v + ch);
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    setValue(value.slice(0, s) + ch + value.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + ch.length, s + ch.length); });
  }

  async function send() {
    if (!task) return;
    setBusy(true);
    setErr(null);
    try {
      await api("/api/translations", { method: "POST", json: { textId: task.textId, language: task.language, content: value } });
      setValue("");
      setToast(true);
      setTimeout(() => setToast(false), 2200);
      await Promise.all([refresh(), reload()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !task) return <TaskSkeleton />;
  if (error) return <p className="error">{error}</p>;
  if (!task) return <EmptyTask message="Il n'y a plus de phrases à traduire pour l'instant. Reviens bientôt !" />;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Photo slot="traduire" className="task-photo" />
      <AnimatePresence mode="wait">
        <motion.div key={task.textId} className="card stack" style={{ gap: 18 }} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="chip chip-green">Français → {LANGUAGES[task.language].label}</span>
            <span className="chip chip-sun">+ {fcfa(RATES.translate)}</span>
          </div>
          <p className="task-text">{task.text}</p>
          <div className="row">
            <SpeakButton text={task.text} label="Écouter" />
            <button className="btn btn-ghost" onClick={() => { setValue(""); reload(); }} disabled={busy}>Passer ⏭️</button>
          </div>

          <div className="field">
            <label htmlFor="tr">Ta traduction en {LANGUAGES[task.language].label}</label>
            <textarea
              id="tr"
              ref={area}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Écris comme on parle chez toi"
              lang={task.language === "moore" ? "mos" : "dyu"}
              autoCapitalize="sentences"
            />
          </div>
          <div className="row" aria-label="Lettres spéciales">
            {(SPECIAL[task.language] ?? []).map((ch) => (
              <button key={ch} type="button" className="chip" style={{ fontSize: "1.1rem", padding: "8px 16px" }} onClick={() => insert(ch)}>{ch}</button>
            ))}
          </div>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn btn-primary btn-lg btn-block" onClick={send} disabled={busy || value.trim().length < 2}>
            {busy ? "Envoi…" : "✅ Envoyer ma traduction"}
          </button>
        </motion.div>
      </AnimatePresence>
      <Toast show={toast}>🎉 Merci ! +{fcfa(RATES.translate)} en attente de validation</Toast>
    </div>
  );
}

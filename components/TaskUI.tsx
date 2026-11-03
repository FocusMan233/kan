"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

export function TaskSkeleton() {
  return (
    <div className="stack">
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 200 }} />
    </div>
  );
}

export function EmptyTask({ message }: { message: string }) {
  return (
    <motion.div className="card center stack" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ padding: 36 }}>
      <div style={{ fontSize: "3rem" }}>🎉</div>
      <h2 style={{ fontSize: "1.6rem" }}>Bravo !</h2>
      <p className="muted">{message}</p>
      <Link href="/app" className="btn btn-primary" style={{ justifySelf: "center" }}>Retour à l'accueil</Link>
    </motion.div>
  );
}

/** Petit message de remerciement qui apparaît puis disparaît. */
export function Toast({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="toast" initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} role="status">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

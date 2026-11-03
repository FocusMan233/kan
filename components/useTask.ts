"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { LangCode } from "@/lib/config";

/** Charge la prochaine tâche (lire, traduire ou valider). `task === null` signifie qu'il n'y a plus rien à faire. */
export function useTask<T>(type: "read" | "translate" | "validate", lang: LangCode | null) {
  const [task, setTask] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!lang) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ task: T | null }>(`/api/tasks/next?type=${type}&lang=${lang}`);
      setTask(r.task);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [type, lang]);

  useEffect(() => { load(); }, [load]);

  return { task, loading, error, reload: load };
}

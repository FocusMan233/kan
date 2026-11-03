"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { LangCode } from "@/lib/config";

export type Me = {
  user: { name: string; langs: LangCode[]; region: string | null };
  stats: { earned: number; pending: number; paid: number; recordings: number; translations: number; validations: number };
};

type Ctx = {
  me: Me | null;
  lang: LangCode | null;
  setLang: (l: LangCode) => void;
  refresh: () => Promise<void>;
};

const MeCtx = createContext<Ctx | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [lang, setLangState] = useState<LangCode | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Me>("/api/me");
      setMe(data);
      setLangState((cur) => {
        if (cur && data.user.langs.includes(cur)) return cur;
        let saved: string | null = null;
        try { saved = localStorage.getItem("kan:lang"); } catch {}
        return (data.user.langs.find((l) => l === saved) ?? data.user.langs[0] ?? null) as LangCode | null;
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace("/login");
    }
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    try { localStorage.setItem("kan:lang", l); } catch {}
  }, []);

  return <MeCtx.Provider value={{ me, lang, setLang, refresh }}>{children}</MeCtx.Provider>;
}

export function useMe() {
  const c = useContext(MeCtx);
  if (!c) throw new Error("useMe doit être utilisé dans <MeProvider>");
  return c;
}

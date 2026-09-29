"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types";
import { api } from "./api";

interface SessionCtx {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ initialUser, children }: { initialUser: SessionUser | null; children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const refresh = useCallback(async () => {
    const r = await api<{ user: SessionUser | null }>("/api/auth/me").catch(() => ({ user: null }));
    setUser(r.user);
  }, []);
  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, setUser, refresh, logout }), [user, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}

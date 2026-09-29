"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

interface ToastState {
  toasts: Toast[];
  push: (text: string, kind?: Toast["kind"]) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(text, kind = "info") {
    const id = ++seq;
    set({ toasts: [...get().toasts, { id, text, kind }].slice(-4) });
    setTimeout(() => get().dismiss(id), kind === "error" ? 6000 : 3500);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = (text: string, kind?: Toast["kind"]) => useToasts.getState().push(text, kind);

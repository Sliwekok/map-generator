"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Button({
  children,
  variant = "secondary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:bg-amber-500/50",
    secondary: "bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-50",
    ghost: "text-slate-200 hover:bg-slate-700/70 disabled:opacity-40",
    danger: "bg-red-600 text-white hover:bg-red-500 disabled:opacity-50",
  }[variant];
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        styles,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  title,
  active,
  className,
  size = 18,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; title: string; active?: boolean; size?: number }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cx(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        active ? "bg-amber-500 text-slate-950" : "text-slate-200 hover:bg-slate-700",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mb-1 text-xs font-medium uppercase tracking-wide text-slate-400", className)}>{children}</div>;
}

/** Number input that commits on blur / Enter, so typing intermediate values doesn't spam history. */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className,
  label,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  label?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(fmt(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    // external value changed -> show it (derived state pattern, no effect needed)
    setPrev(value);
    setText(fmt(value));
  }
  const commit = () => {
    let n = parseFloat(text.replace(",", "."));
    if (!Number.isFinite(n)) return setText(fmt(value));
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    if (n !== value) onChange(n);
    setText(fmt(n));
  };
  return (
    <label className={cx("flex items-center gap-1 rounded-md bg-slate-900 px-2 ring-1 ring-slate-700 focus-within:ring-amber-500", className)}>
      {label && <span className="text-xs text-slate-500">{label}</span>}
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className="w-full min-w-0 bg-transparent py-1.5 text-sm text-slate-100 outline-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            let n = value + d;
            if (min !== undefined) n = Math.max(min, n);
            if (max !== undefined) n = Math.min(max, n);
            onChange(n);
          }
        }}
      />
      {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
    </label>
  );
}

function fmt(n: number) {
  return String(Math.round(n * 100) / 100);
}

export function ColorField({ value, onChange, title }: { value: string; onChange: (v: string) => void; title?: string }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : expand(value);
  return (
    <label className="flex items-center gap-2 rounded-md bg-slate-900 px-2 py-1 ring-1 ring-slate-700" title={title}>
      <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" />
      <span className="font-mono text-xs text-slate-300">{safe}</span>
    </label>
  );
}

function expand(v: string) {
  if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + v.slice(1).split("").map((c) => c + c).join("");
  if (/^#[0-9a-f]{8}$/i.test(v)) return v.slice(0, 7);
  return "#000000";
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  onStart,
  onEnd,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  onStart?: () => void;
  onEnd?: () => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onPointerDown={onStart}
      onPointerUp={onEnd}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-amber-500"
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-slate-800 p-6 text-slate-100 shadow-2xl ring-1 ring-slate-700",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <IconButton icon="x" title="Close" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-900 p-1 ring-1 ring-slate-700">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            value === o.value ? "bg-amber-500 font-semibold text-slate-950" : "text-slate-300 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

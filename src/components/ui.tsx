import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/* ─────────── Surface / Card ─────────── */
export function Card({
  children,
  className,
  glow,
  ...rest
}: PropsWithChildren<{ className?: string; glow?: boolean }> & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "surface p-3.5 animate-fade-up",
        glow && "glow-ring",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ─────────── Buttons ─────────── */
type ButtonVariant = "default" | "primary" | "ghost";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export function Button({ className, variant = "default", loading, children, disabled, ...rest }: ButtonProps) {
  const variantClass = variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : "btn";
  return (
    <button className={clsx(variantClass, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={14} className="animate-spin-slow" /> : null}
      {children}
    </button>
  );
}

/* ─────────── Form fields ─────────── */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx("input", props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx("textarea", props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx("select cursor-pointer", props.className)} />;
}
export function Label({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <label className={clsx("label", className)}>{children}</label>;
}

/* ─────────── Chips & badges ─────────── */
export function Chip({
  children,
  tone = "neutral",
  className,
}: PropsWithChildren<{ tone?: "neutral" | "good" | "warn" | "bad" | "accent"; className?: string }>) {
  const cls =
    tone === "good"
      ? "chip-good"
      : tone === "warn"
        ? "chip-warn"
        : tone === "bad"
          ? "chip-bad"
          : tone === "accent"
            ? "chip-accent"
            : "chip";
  return <span className={clsx(cls, className)}>{children}</span>;
}

/* ─────────── Live status dot (for "Active tab" indicator) ─────────── */
export function StatusDot({ tone = "good" }: { tone?: "good" | "warn" | "bad" }) {
  const color =
    tone === "good"
      ? "bg-emerald-400 shadow-[0_0_10px_2px_rgba(74,222,128,0.55)]"
      : tone === "warn"
        ? "bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.55)]"
        : "bg-rose-400 shadow-[0_0_10px_2px_rgba(251,113,133,0.55)]";
  return (
    <span className="relative inline-flex h-2 w-2 items-center justify-center">
      <span className={clsx("absolute inline-flex h-2 w-2 rounded-full opacity-75 animate-pulse-dot", color)} />
      <span className={clsx("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}

/* ─────────── Loading skeletons ─────────── */
export function SkeletonLine({ w = "100%" }: { w?: string }) {
  return (
    <div
      className="h-3 rounded-md animate-shimmer"
      style={{ width: w, background: "rgba(15,23,42,0.05)" }}
    />
  );
}

/* ─────────── A score "ring" — minimalistic radial gauge ─────────── */
export function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;
  const tone =
    clamped >= 80 ? "var(--good)" : clamped >= 50 ? "var(--accent)" : clamped >= 30 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} stroke="rgba(15,23,42,0.06)" strokeWidth="6" fill="none" />
        <circle
          cx="36"
          cy="36"
          r={r}
          stroke={tone}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-semibold tabular-nums" style={{ color: "var(--text)" }}>{clamped}</span>
        <span className="text-[9px] uppercase tracking-wider text-[var(--text-faint)]">match</span>
      </div>
    </div>
  );
}

/* ─────────── Toast (minimal, ephemeral) ─────────── */
export function Toast({ children }: PropsWithChildren) {
  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 surface-strong px-3 py-2 text-xs animate-fade-up"
      style={{ color: "var(--text)" }}
    >
      {children}
    </div>
  );
}

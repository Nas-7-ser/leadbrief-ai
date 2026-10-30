import { ChevronDown, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import type { Persona } from "../types/settings";

type Props = {
  personas: Persona[];
  activePersonaId: string;
  onChange: (id: string) => void;
  className?: string;
};

export function PersonaSwitcher({ personas, activePersonaId, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = personas.find((p) => p.id === activePersonaId) ?? personas[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!active) return null;

  return (
    <div ref={ref} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-transparent px-2.5 py-1.5 text-[12px] font-medium transition-all hover:bg-[var(--surface-tint)]"
        style={{ color: "var(--text)" }}
      >
        <Target size={12} className="text-[var(--accent)]" />
        <span className="max-w-[140px] truncate">{active.name}</span>
        <ChevronDown size={11} className="text-[var(--text-faint)]" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-40 mt-1.5 min-w-[200px] surface-strong p-1.5 animate-fade-up"
          role="listbox"
        >
          {personas.map((p) => {
            const isActive = p.id === activePersonaId;
            return (
              <button
                key={p.id}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors",
                  isActive ? "bg-[var(--surface-tint)]" : "hover:bg-[var(--surface-tint)]",
                )}
              >
                <span
                  className={clsx(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    isActive ? "bg-[var(--accent)] shadow-[0_0_8px_rgba(91,110,255,0.45)]" : "bg-[var(--border-strong)]",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className={clsx("block truncate font-medium", isActive ? "text-[var(--text)]" : "text-[var(--text-muted)]")}>
                    {p.name}
                  </span>
                  <span className="block truncate text-[10.5px] text-[var(--text-faint)]">
                    {firstLine(p.idealProspectCriteria) || "No criteria yet"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function firstLine(text: string): string {
  return text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
}

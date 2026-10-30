import { Check, Copy, RefreshCw, Sparkles, SpellCheck2, Wand2 } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import type { MessageStyle, MessageSuggestions, PolishMode } from "../types/message";
import { Button, Card, Textarea } from "./ui";

const STYLES: { id: Exclude<MessageStyle, "custom">; label: string; desc: string }[] = [
  { id: "professional", label: "Professional", desc: "Polite, polished" },
  { id: "casual", label: "Casual", desc: "Warm, peer-to-peer" },
  { id: "subtle", label: "Subtle", desc: "Low-pressure, curious" },
];

type Props = {
  aiEnabled: boolean;
  suggestions: MessageSuggestions | null;
  loading: boolean;
  customDraft: string;
  onCustomDraftChange: (text: string) => void;
  onGenerateSuggestions: () => void;
  onPolish: (text: string, mode: PolishMode) => Promise<string | null>;
  onCopy: (text: string, style: MessageStyle) => void;
  copyToast?: string | null;
};

export function MessageStudio({
  aiEnabled,
  suggestions,
  loading,
  customDraft,
  onCustomDraftChange,
  onGenerateSuggestions,
  onPolish,
  onCopy,
  copyToast,
}: Props) {
  const [activeStyle, setActiveStyle] = useState<Exclude<MessageStyle, "custom">>("professional");
  const [polishing, setPolishing] = useState<PolishMode | null>(null);

  const activeText = suggestions?.[activeStyle] ?? "";

  async function handlePolish(mode: PolishMode) {
    if (!aiEnabled || !customDraft.trim()) return;
    setPolishing(mode);
    const result = await onPolish(customDraft, mode);
    if (result) onCustomDraftChange(result);
    setPolishing(null);
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="label mb-0 flex items-center gap-1.5">
            <Sparkles size={11} />
            AI suggestions
          </p>
          <Button variant="ghost" onClick={onGenerateSuggestions} loading={loading} disabled={!aiEnabled}>
            <RefreshCw size={12} />
            {suggestions ? "Regenerate" : "Generate"}
          </Button>
        </div>

        {suggestions ? (
          <>
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {STYLES.map((s) => {
                const isActive = activeStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveStyle(s.id)}
                    className={clsx("rounded-xl px-2 py-1.5 text-left transition-all border")}
                    style={
                      isActive
                        ? {
                            borderColor: "var(--accent)",
                            background: "rgba(91,110,255,0.06)",
                            boxShadow: "var(--shadow-sm)",
                          }
                        : {
                            borderColor: "var(--border)",
                            background: "var(--surface)",
                          }
                    }
                  >
                    <div
                      className="text-[11px] font-semibold"
                      style={{ color: isActive ? "var(--text)" : "var(--text-muted)" }}
                    >
                      {s.label}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                      {s.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="surface-strong p-3">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: "var(--text)" }}>
                {activeText}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{activeText.length} chars</span>
                <div className="flex gap-1.5">
                  <Button variant="ghost" onClick={() => onCustomDraftChange(activeText)}>
                    Edit
                  </Button>
                  <Button variant="primary" onClick={() => onCopy(activeText, activeStyle)}>
                    {copyToast === activeStyle ? <Check size={13} /> : <Copy size={13} />}
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Click <span style={{ color: "var(--text)" }}>Generate</span> to get three short message variations tuned to this prospect.
          </p>
        )}
      </Card>

      <Card>
        <p className="label">Your version</p>
        <Textarea
          value={customDraft}
          onChange={(e) => onCustomDraftChange(e.target.value)}
          placeholder="Write your own message, or pick one above and tweak it..."
          rows={5}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="ghost"
              onClick={() => void handlePolish("fix_grammar")}
              loading={polishing === "fix_grammar"}
              disabled={!aiEnabled || !customDraft.trim()}
            >
              <SpellCheck2 size={12} />
              Fix grammar
            </Button>
            <Button
              variant="ghost"
              onClick={() => void handlePolish("improve")}
              loading={polishing === "improve"}
              disabled={!aiEnabled || !customDraft.trim()}
            >
              <Wand2 size={12} />
              Improve slightly
            </Button>
          </div>
          <Button
            variant="primary"
            onClick={() => onCopy(customDraft, "custom")}
            disabled={!customDraft.trim()}
          >
            {copyToast === "custom" ? <Check size={13} /> : <Copy size={13} />}
            Copy & save
          </Button>
        </div>
        <p className="mt-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
          Copy & save logs the exact text used. Re-saving the same prospect won't create a duplicate.
        </p>
      </Card>
    </div>
  );
}

import { Check, KeyRound, Plus, Save, Shield, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { isOpenAIConfigured } from "../lib/apiAccess";
import type { Persona, Settings } from "../types/settings";
import { Button, Card, Input, Label, Select, Textarea } from "./ui";

type Props = {
  settings: Settings;
  onSave: (next: Settings) => Promise<void>;
  onDeletePersona: (
    deletedId: string,
    fallbackId: string,
    nextSettings: Settings,
  ) => Promise<void>;
};

export function SettingsView({ settings, onSave, onDeletePersona }: Props) {
  const [draft, setDraft] = useState(settings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const keyConfigured = isOpenAIConfigured(draft);

  async function handleSave() {
    await onSave(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updatePersona(id: string, patch: Partial<Persona>) {
    setDraft((prev) => ({
      ...prev,
      personas: prev.personas.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function addPersona() {
    const id = crypto.randomUUID();
    setDraft((prev) => ({
      ...prev,
      personas: [
        ...prev.personas,
        {
          id,
          name: `Persona ${prev.personas.length + 1}`,
          idealProspectCriteria:
            "Describe who you sell to, what an ideal prospect looks like, and what disqualifies one.",
        },
      ],
      activePersonaId: id,
    }));
  }

  async function handleDelete(id: string) {
    if (draft.personas.length <= 1) return;
    const draftFallback = draft.personas.find((persona) => persona.id !== id);
    if (!draftFallback) return;

    const savedHasPersona = settings.personas.some((persona) => persona.id === id);
    const remainingSaved = settings.personas.filter((persona) => persona.id !== id);
    if (savedHasPersona && remainingSaved.length === 0) {
      setConfirmDeleteId(null);
      setNotice("Save settings before deleting the last saved persona.");
      return;
    }

    setDraft({
      ...draft,
      personas: draft.personas.filter((persona) => persona.id !== id),
      activePersonaId: draft.activePersonaId === id ? draftFallback.id : draft.activePersonaId,
    });
    setConfirmDeleteId(null);
    setNotice(null);

    if (!savedHasPersona) return;

    const fallbackId = remainingSaved.some((persona) => persona.id === settings.activePersonaId)
      ? settings.activePersonaId
      : remainingSaved[0].id;
    await onDeletePersona(id, fallbackId, {
      ...settings,
      personas: remainingSaved,
      activePersonaId: fallbackId,
    });
  }

  return (
    <div className="space-y-3">
      {/* Privacy — always visible at top */}
      <Card glow>
        <div className="flex items-start gap-2.5">
          <Shield size={15} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
          <div>
            <p className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
              Your data stays on your device
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Leads, personas, messages, and your OpenAI API key are stored{" "}
              <span style={{ color: "var(--text)" }}>locally in Chrome only</span>. We don't collect, store, or
              see any of it — we don't know how you use the extension.
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              When you analyze a page, text is sent{" "}
              <span style={{ color: "var(--text)" }}>directly from your browser to OpenAI</span> using your own
              key. During this beta, the only signal we get is aggregate install counts from the Chrome Web Store.
            </p>
          </div>
        </div>
      </Card>

      {/* OpenAI — required before first use */}
      <Card glow={!keyConfigured}>
        <div className="mb-2 flex items-center gap-1.5">
          <KeyRound size={13} style={{ color: "var(--accent)" }} />
          <p className="label mb-0">OpenAI API key (required)</p>
          {isOpenAIConfigured(settings) ? (
            <span className="chip-good ml-auto">Saved</span>
          ) : (
            <span className="chip-warn ml-auto">Not saved yet</span>
          )}
        </div>
        <p className="mb-2.5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          You must add your key and click <span style={{ color: "var(--text)" }}>Save settings</span> before
          analyzing prospects. Create a key at{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
            style={{ color: "var(--accent)" }}
          >
            platform.openai.com
          </a>
          .
        </p>
        <Input
          type="password"
          value={draft.openaiApiKey ?? ""}
          onChange={(e) => set("openaiApiKey", e.target.value)}
          placeholder="Paste your key"
        />
        {!draft.openaiApiKey?.trim() ? (
          <p className="mt-2 text-[11px]" style={{ color: "var(--warn)" }}>
            Analysis is disabled until a key is saved.
          </p>
        ) : !isOpenAIConfigured(settings) ? (
          <p className="mt-2 text-[11px]" style={{ color: "var(--warn)" }}>
            Key entered — click Save settings below to enable analysis.
          </p>
        ) : null}
      </Card>

      {/* PERSONAS */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Target size={13} className="text-[var(--accent)]" />
            <p className="label mb-0">Personas</p>
          </div>
          <Button variant="ghost" onClick={addPersona}>
            <Plus size={12} />
            New
          </Button>
        </div>
        <p className="mt-1.5 mb-3 text-[11px] text-[var(--text-muted)] leading-relaxed">
          Each persona is its own lead list with its own ideal-prospect criteria. The active persona drives the
          scoring of every new analysis.
        </p>

        <div className="space-y-2.5">
          {draft.personas.map((p) => {
            const isActive = p.id === draft.activePersonaId;
            const isOnly = draft.personas.length === 1;
            const confirming = confirmDeleteId === p.id;
            return (
              <div
                key={p.id}
                className={clsx(
                  "rounded-2xl border p-3 transition-all",
                  isActive
                    ? "border-[var(--accent)] bg-[rgba(91,110,255,0.04)]"
                    : "border-[var(--border)] bg-[var(--surface)]",
                )}
                style={isActive ? { boxShadow: "var(--shadow-glow)" } : undefined}
              >
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => set("activePersonaId", p.id)}
                    className={clsx(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-all",
                      isActive ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-strong)] bg-white",
                    )}
                    aria-label="Activate persona"
                  >
                    {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </button>
                  <Input
                    value={p.name}
                    onChange={(e) => updatePersona(p.id, { name: e.target.value })}
                    className="flex-1 !py-1.5 !text-[13px] !font-medium"
                    placeholder="Persona name"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (isOnly) return;
                      if (confirming) {
                        void handleDelete(p.id);
                      } else {
                        setConfirmDeleteId(p.id);
                        setTimeout(() => setConfirmDeleteId(null), 2500);
                      }
                    }}
                    disabled={isOnly}
                    className={clsx("btn-ghost !p-1.5", confirming ? "text-[var(--bad)]" : "")}
                    aria-label="Delete persona"
                    title={
                      isOnly
                        ? "You need at least one persona"
                        : confirming
                          ? "Click again to confirm"
                          : "Delete persona"
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <Textarea
                  rows={6}
                  value={p.idealProspectCriteria}
                  onChange={(e) => updatePersona(p.id, { idealProspectCriteria: e.target.value })}
                  placeholder="What you sell, who you sell it to, what 'ideal' looks like, and what disqualifies a prospect..."
                />
                {confirming ? (
                  <p className="mt-1.5 text-[10.5px] text-[var(--bad)]">
                    Click trash again to delete. Its leads will move to "
                    {draft.personas.find((q) => q.id !== p.id)?.name ?? "another"}".
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {notice ? (
          <p className="mt-2 text-[11px]" style={{ color: "var(--warn)" }}>
            {notice}
          </p>
        ) : null}
      </Card>

      {/* Sender info */}
      <Card>
        <p className="label">Your identity</p>
        <div className="space-y-2.5">
          <div>
            <Label>Sender name</Label>
            <Input
              value={draft.senderName}
              onChange={(e) => set("senderName", e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <Label>Company</Label>
            <Input
              value={draft.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <Label>Signature (optional)</Label>
            <Input
              value={draft.signature}
              onChange={(e) => set("signature", e.target.value)}
              placeholder="— Jane"
            />
          </div>
          <div>
            <Label>Message language</Label>
            <Select
              value={draft.messageLanguage}
              onChange={(e) => set("messageLanguage", e.target.value as Settings["messageLanguage"])}
            >
              <option value="auto">Auto-detect</option>
              <option value="english">English</option>
              <option value="french">Français</option>
            </Select>
          </div>
        </div>
      </Card>

      <Button variant="primary" className="w-full" onClick={() => void handleSave()}>
        {savedFlash ? <Check size={14} /> : <Save size={14} />}
        {savedFlash ? "Saved" : "Save settings"}
      </Button>
    </div>
  );
}

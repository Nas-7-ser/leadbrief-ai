import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Bookmark,
  CheckCircle2,
  Clock,
  Copy,
  Inbox,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { clsx } from "clsx";
import { Button, Card, Chip, Input, ScoreRing, Toast } from "../components/ui";
import {
  deleteProspect,
  getSavedProspects,
  getSettings,
  onProspectsChanged,
  onSettingsChanged,
  saveSettings,
  setStatus,
  updateProspect,
} from "../lib/chromeStorage";
import { followUpDateToIso, isFollowUpDue, todayDateInputValue } from "../lib/dates";
import type { LeadStatus, SavedProspect } from "../types/prospect";
import type { Persona, Settings } from "../types/settings";

const STATUS_FILTERS: { id: "all" | LeadStatus | "due"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "saved", label: "Saved" },
  { id: "contacted", label: "Contacted" },
  { id: "follow_up", label: "Follow-up" },
  { id: "due", label: "Due now" },
  { id: "responded", label: "Responded" },
];

const STATUS_ACTIONS: { id: LeadStatus; label: string; icon: typeof Bookmark }[] = [
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "contacted", label: "Contacted", icon: MessageCircle },
  { id: "follow_up", label: "Follow-up", icon: Bell },
  { id: "responded", label: "Responded", icon: CheckCircle2 },
];

const STATUS_LABEL: Record<LeadStatus, { label: string; tone: "neutral" | "good" | "warn" | "bad" | "accent" }> = {
  saved: { label: "Saved", tone: "neutral" },
  contacted: { label: "Contacted", tone: "accent" },
  follow_up: { label: "Follow-up", tone: "warn" },
  responded: { label: "Responded", tone: "good" },
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function tryHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LeadsPage() {
  const [prospects, setProspects] = useState<SavedProspect[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<string>("");
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Load + subscribe to live updates for both prospects and settings.
  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setSettings(s);
      setActivePersonaId(s.activePersonaId);
      setProspects(await getSavedProspects());
    })();
    const unsubP = onProspectsChanged(setProspects);
    const unsubS = onSettingsChanged((s) => {
      setSettings(s);
      // Don't override the user's local page selection unless the active persona was deleted.
      setActivePersonaId((current) => (s.personas.some((p) => p.id === current) ? current : s.activePersonaId));
    });
    return () => {
      unsubP();
      unsubS();
    };
  }, []);

  const personaList = settings?.personas ?? [];
  const personaProspects = useMemo(
    () => prospects.filter((p) => p.personaId === activePersonaId),
    [prospects, activePersonaId],
  );

  const personaCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of prospects) map[p.personaId] = (map[p.personaId] ?? 0) + 1;
    return map;
  }, [prospects]);

  const counts = useMemo(() => {
    const dueCount = personaProspects.filter(isFollowUpDue).length;
    return {
      all: personaProspects.length,
      saved: personaProspects.filter((p) => p.status === "saved").length,
      contacted: personaProspects.filter((p) => p.status === "contacted").length,
      follow_up: personaProspects.filter((p) => p.status === "follow_up").length,
      responded: personaProspects.filter((p) => p.status === "responded").length,
      due: dueCount,
    };
  }, [personaProspects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return personaProspects.filter((p) => {
      const matchSearch =
        !q ||
        p.brief.companyName.toLowerCase().includes(q) ||
        p.brief.sectorOrRole.toLowerCase().includes(q) ||
        (p.brief.decisionMaker ?? "").toLowerCase().includes(q);
      const matchFilter =
        filter === "all" || (filter === "due" ? isFollowUpDue(p) : p.status === filter);
      return matchSearch && matchFilter;
    });
  }, [personaProspects, search, filter]);

  const active = useMemo(
    () => filtered.find((p) => p.id === selected) ?? filtered[0] ?? null,
    [filtered, selected],
  );

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  }

  async function handleStatus(id: string, status: LeadStatus, followUpAt?: string) {
    await setStatus(id, status, followUpAt);
    flash(`Marked as ${STATUS_LABEL[status].label.toLowerCase()}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lead permanently?")) return;
    await deleteProspect(id);
    if (selected === id) setSelected(null);
    flash("Deleted");
  }

  async function copyLatestMessage(p: SavedProspect) {
    if (!p.finalMessage) return;
    try {
      await navigator.clipboard.writeText(p.finalMessage);
      flash("Message copied");
    } catch {
      flash("Browser blocked copying");
    }
  }

  async function setActivePersonaPersisted(id: string) {
    if (id === activePersonaId) return;
    setActivePersonaId(id);
    setSelected(null);
    if (settings) {
      const next: Settings = { ...settings, activePersonaId: id };
      setSettings(next);
      await saveSettings(next);
    }
  }

  return (
    <div className="min-h-screen mx-auto max-w-[1200px] px-6 py-7">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-10 w-10 place-items-center rounded-2xl shrink-0" style={{ background: "var(--accent-grad)", boxShadow: "var(--shadow-glow)" }}>
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Lead<span className="gradient-text">Brief</span>
              <span className="ml-2 text-sm font-normal" style={{ color: "var(--text-muted)" }}>· Leads</span>
            </h1>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {counts.all} in <span style={{ color: "var(--text)" }}>{personaList.find((p) => p.id === activePersonaId)?.name ?? "—"}</span>
              {" · "}
              {counts.contacted} contacted · {counts.follow_up} on follow-up · {counts.responded} responded
            </p>
          </div>
        </div>
        {counts.due > 0 ? (
          <Chip tone="warn">
            <Bell size={11} />
            {counts.due} follow-up{counts.due > 1 ? "s" : ""} due
          </Chip>
        ) : null}
      </header>

      {/* Persona tabs */}
      {personaList.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {personaList.map((p) => (
            <PersonaTab
              key={p.id}
              persona={p}
              active={p.id === activePersonaId}
              count={personaCounts[p.id] ?? 0}
              onClick={() => void setActivePersonaPersisted(p.id)}
            />
          ))}
        </div>
      ) : null}

      {/* Search + filters */}
      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto] items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, sector or decision maker…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => {
            const count = counts[f.id as keyof typeof counts];
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-[12px] font-medium transition-all border",
                )}
                style={
                  isActive
                    ? {
                        borderColor: "var(--accent)",
                        background: "rgba(91,110,255,0.08)",
                        color: "var(--text)",
                      }
                    : {
                        borderColor: "var(--border)",
                        background: "var(--surface)",
                        color: "var(--text-muted)",
                      }
                }
              >
                {f.label}
                {typeof count === "number" ? (
                  <span className="ml-1.5 tabular-nums" style={{ color: "var(--text-faint)" }}>{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty */}
      {personaProspects.length === 0 ? (
        <Card className="text-center py-16">
          <Inbox size={28} className="mx-auto" style={{ color: "var(--text-faint)" }} />
          <p className="mt-3 text-sm font-medium" style={{ color: "var(--text)" }}>
            No leads in this persona yet
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            Open the side panel, analyze a prospect, then copy a message — it'll land here automatically.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,420px)]">
          <div className="space-y-2.5">
            {filtered.length === 0 ? (
              <Card>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No leads match this filter.</p>
              </Card>
            ) : (
              filtered.map((p) => (
                <LeadCard
                  key={p.id}
                  prospect={p}
                  selected={active?.id === p.id}
                  onSelect={() => setSelected(p.id)}
                />
              ))
            )}
          </div>

          <aside className="lg:sticky lg:top-7 self-start">
            {active ? (
              <LeadDetail
                key={active.id}
                prospect={active}
                onStatus={handleStatus}
                onDelete={() => void handleDelete(active.id)}
                onCopy={() => void copyLatestMessage(active)}
                onSetReminder={(iso) => void handleStatus(active.id, "follow_up", iso)}
                onUpdateNotes={(notes) => {
                  void updateProspect(active.id, { notes });
                  flash("Notes saved");
                }}
              />
            ) : (
              <Card>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Select a lead to see details.</p>
              </Card>
            )}
          </aside>
        </div>
      )}

      {toast ? <Toast>{toast}</Toast> : null}
    </div>
  );
}

/* ─────────── Persona tab ─────────── */
function PersonaTab({
  persona,
  active,
  count,
  onClick,
}: {
  persona: Persona;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-medium transition-all border",
      )}
      style={
        active
          ? {
              borderColor: "var(--accent)",
              background: "rgba(91,110,255,0.06)",
              color: "var(--text)",
              boxShadow: "var(--shadow-sm)",
            }
          : {
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--text-muted)",
            }
      }
    >
      <span
        className={clsx("h-1.5 w-1.5 rounded-full")}
        style={
          active
            ? { background: "var(--accent)", boxShadow: "0 0 8px rgba(91,110,255,0.45)" }
            : { background: "var(--border-strong)" }
        }
      />
      <span className="truncate max-w-[180px]">{persona.name}</span>
      <span className="tabular-nums text-[11px]" style={{ color: active ? "var(--text-muted)" : "var(--text-faint)" }}>
        {count}
      </span>
    </button>
  );
}

/* ─────────── Lead row card ─────────── */
function LeadCard({
  prospect,
  selected,
  onSelect,
}: {
  prospect: SavedProspect;
  selected: boolean;
  onSelect: () => void;
}) {
  const due = isFollowUpDue(prospect);
  const status = STATUS_LABEL[prospect.status];
  return (
    <button
      onClick={onSelect}
      className={clsx("w-full text-left transition-all surface p-4")}
      style={
        selected
          ? { borderColor: "var(--accent)", background: "rgba(91,110,255,0.04)", boxShadow: "var(--shadow-md)" }
          : undefined
      }
    >
      <div className="flex items-start gap-4">
        <ScoreRing score={prospect.brief.matchScore} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
              {prospect.brief.companyName}
            </h3>
            {due ? (
              <Chip tone="warn">
                <AlertCircle size={10} />
                Due
              </Chip>
            ) : (
              <Chip tone={status.tone}>{status.label}</Chip>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
            {prospect.brief.sectorOrRole}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
            {prospect.brief.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={10} />
                {prospect.brief.location}
              </span>
            ) : null}
            {prospect.brief.decisionMaker ? (
              <span className="inline-flex items-center gap-1">
                <UserRound size={10} />
                {prospect.brief.decisionMaker}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Clock size={10} />
              {formatDate(prospect.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ─────────── Detail panel ─────────── */
function LeadDetail({
  prospect,
  onStatus,
  onDelete,
  onCopy,
  onSetReminder,
  onUpdateNotes,
}: {
  prospect: SavedProspect;
  onStatus: (id: string, status: LeadStatus, followUpAt?: string) => void;
  onDelete: () => void;
  onCopy: () => void;
  onSetReminder: (iso: string) => void;
  onUpdateNotes: (notes: string) => void;
}) {
  // key={prospect.id} on parent → state seeds fresh per lead.
  const [reminderDate, setReminderDate] = useState<string>(prospect.followUpAt?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(prospect.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);

  const status = STATUS_LABEL[prospect.status];

  return (
    <div className="space-y-3">
      <Card className="surface-strong">
        <div className="flex items-start gap-3">
          <ScoreRing score={prospect.brief.matchScore} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold" style={{ color: "var(--text)" }}>
              {prospect.brief.companyName}
            </h3>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{prospect.brief.sectorOrRole}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip tone={status.tone}>{status.label}</Chip>
              {prospect.brief.location ? (
                <Chip>
                  <MapPin size={10} />
                  {prospect.brief.location}
                </Chip>
              ) : null}
              {prospect.brief.decisionMaker ? (
                <Chip tone="accent">
                  <UserRound size={10} />
                  {prospect.brief.decisionMaker}
                </Chip>
              ) : null}
            </div>
          </div>
        </div>

        <a
          href={prospect.pageUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] hover:underline"
          style={{ color: "var(--accent)" }}
        >
          {tryHostname(prospect.pageUrl)}
          <ArrowUpRight size={11} />
        </a>
      </Card>

      <Card>
        <p className="label">Update status</p>
        <div className="grid grid-cols-2 gap-1.5">
          {STATUS_ACTIONS.map((action) => {
            const Icon = action.icon;
            const active = prospect.status === action.id;
            return (
              <Button
                key={action.id}
                variant={active ? "primary" : "default"}
                aria-pressed={active}
                onClick={() => {
                  if (active) return;
                  onStatus(
                    prospect.id,
                    action.id,
                    action.id === "follow_up" ? prospect.followUpAt : undefined,
                  );
                }}
              >
                <Icon size={12} />
                {action.label}
              </Button>
            );
          })}
        </div>

        <div className="mt-3 space-y-2">
          <p className="label">Follow-up reminder</p>
          <div className="flex gap-2">
            <input
              type="date"
              className="input flex-1"
              value={reminderDate}
              min={todayDateInputValue()}
              onChange={(e) => setReminderDate(e.target.value)}
            />
            <Button
              variant="primary"
              disabled={!reminderDate}
              onClick={() => onSetReminder(followUpDateToIso(reminderDate))}
            >
              <Bell size={12} />
              Set
            </Button>
          </div>
          {prospect.followUpAt ? (
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Currently scheduled for{" "}
              <span style={{ color: "var(--text)" }}>{formatDate(prospect.followUpAt)}</span>
            </p>
          ) : null}
        </div>
      </Card>

      {prospect.finalMessage ? (
        <Card>
          <div className="flex items-center justify-between mb-1.5">
            <p className="label mb-0">Sent message ({prospect.finalMessageStyle ?? "custom"})</p>
            <Button variant="ghost" onClick={onCopy}>
              <Copy size={12} />
              Copy again
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: "var(--text)" }}>
            {prospect.finalMessage}
          </p>
        </Card>
      ) : null}

      <Card>
        <p className="label">Why this score</p>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text)" }}>{prospect.brief.matchReason}</p>
        {prospect.brief.signals.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {prospect.brief.signals.map((s, i) => (
              <li key={i} className="flex gap-2 text-[12px]" style={{ color: "var(--text)" }}>
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <p className="label">Notes</p>
        <textarea
          className="textarea"
          rows={3}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesDirty(true);
          }}
          placeholder="Quick notes about this lead…"
        />
        <div className="mt-2 flex justify-end">
          <Button
            variant="ghost"
            disabled={!notesDirty}
            onClick={() => {
              onUpdateNotes(notes);
              setNotesDirty(false);
            }}
          >
            Save notes
          </Button>
        </div>
      </Card>

      <button onClick={onDelete} className="btn-ghost w-full" style={{ color: "var(--bad)" }}>
        <Trash2 size={12} />
        Delete lead
      </button>
    </div>
  );
}

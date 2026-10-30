import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  ArrowRight,
  BookmarkCheck,
  ExternalLink,
  Inbox,
  MessageSquareText,
  ScanSearch,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import { BriefView } from "../components/Brief";
import { MessageStudio } from "../components/MessageStudio";
import { PersonaSwitcher } from "../components/PersonaSwitcher";
import { SettingsView } from "../components/SettingsView";
import { Button, Card, SkeletonLine, StatusDot, Toast } from "../components/ui";
import {
  findProspectByUrl,
  getActivePersona,
  getSavedProspects,
  getSettings,
  leadKey,
  onProspectsChanged,
  reassignProspects,
  saveSettings,
  upsertProspect,
} from "../lib/chromeStorage";
import { AI_LIMITATION_NOTE } from "../lib/constants";
import { isOpenAIConfigured, OPENAI_KEY_REQUIRED_MSG } from "../lib/apiAccess";
import { callOpenAI } from "../lib/openaiClient";
import {
  buildMessageSuggestionsPrompt,
  buildPolishPrompt,
  buildProspectBriefPrompt,
} from "../lib/prompts";
import {
  briefJsonSchema,
  messageSuggestionsSchema,
  messagesJsonSchema,
  polishedMessageSchema,
  polishJsonSchema,
  prospectBriefSchema,
} from "../lib/schemas";
import type { MessageStyle, MessageSuggestions, PolishMode } from "../types/message";
import type { LeadStatus, ProspectAnalysisInput, ProspectBrief, SavedProspect } from "../types/prospect";
import type { Settings } from "../types/settings";
import { extractPageInPageContext, type ExtractedPageContext } from "./extractInPage";

type Tab = "analyze" | "message" | "settings";

type ActiveTabInfo = {
  tabId: number;
  url: string;
  title: string;
  isAnalyzable: boolean;
  reason?: string;
};

async function findProspectTab(): Promise<ActiveTabInfo | null> {
  const focused = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  for (const tab of focused) {
    if (tab.id && tab.url) return classifyTab(tab);
  }
  const all = await chrome.tabs.query({ active: true });
  for (const tab of all) {
    if (tab.id && tab.url && /^https?:/i.test(tab.url)) return classifyTab(tab);
  }
  if (all.length && all[0].id && all[0].url) return classifyTab(all[0]);
  return null;
}

function classifyTab(tab: chrome.tabs.Tab): ActiveTabInfo {
  const url = tab.url ?? "";
  const isHttp = /^https?:\/\//i.test(url);
  const isExtension = url.startsWith("chrome-extension://") || url.startsWith("moz-extension://");
  const isBrowserPage =
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("brave://") ||
    url.startsWith("view-source:");
  const reason = !isHttp
    ? isExtension
      ? "This is an extension page. Switch to the prospect's website tab."
      : isBrowserPage
        ? "Browser internal page. Switch to a normal website tab."
        : "Open a normal http(s) website tab."
    : undefined;
  return {
    tabId: tab.id ?? -1,
    url,
    title: tab.title ?? "Untitled",
    isAnalyzable: isHttp && !isExtension && !isBrowserPage && tab.id !== undefined,
    reason,
  };
}

function tryHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const TABS: { id: Tab; label: string; icon: typeof ScanSearch }[] = [
  { id: "analyze", label: "Analyze", icon: ScanSearch },
  { id: "message", label: "Message", icon: MessageSquareText },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function SidePanelApp() {
  const [tab, setTab] = useState<Tab>("analyze");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tabInfo, setTabInfo] = useState<ActiveTabInfo | null>(null);
  const [page, setPage] = useState<ExtractedPageContext | null>(null);
  const [brief, setBrief] = useState<ProspectBrief | null>(null);
  const [existingLead, setExistingLead] = useState<SavedProspect | null>(null);
  const [savedCountForPersona, setSavedCountForPersona] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<MessageSuggestions | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [transientToast, setTransientToast] = useState<string | null>(null);
  const [settingsRevision, setSettingsRevision] = useState(0);

  const activePersona = settings ? getActivePersona(settings) : null;

  // Initial load
  useEffect(() => {
    void (async () => {
      const initial = await getSettings();
      setSettings(initial);
      setSettingsRevision((r) => r + 1);
    })();
  }, []);

  // Whenever active tab OR persona changes, refresh "already saved" check + count
  useEffect(() => {
    if (!settings || !activePersona) return;
    let cancelled = false;
    void (async () => {
      const all = await getSavedProspects();
      if (cancelled) return;
      setSavedCountForPersona(all.filter((p) => p.personaId === activePersona.id).length);
      const url = tabInfo?.url;
      if (url && /^https?:/i.test(url)) {
        const existing = await findProspectByUrl(url, activePersona.id);
        if (!cancelled) setExistingLead(existing);
      } else if (!cancelled) {
        setExistingLead(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tabInfo?.url, settings, activePersona]);

  // Keep inbox count + "already saved" card in sync when Leads page edits storage.
  useEffect(() => {
    if (!activePersona) return;
    const unsub = onProspectsChanged((all) => {
      setSavedCountForPersona(all.filter((p) => p.personaId === activePersona.id).length);
      const url = tabInfo?.url;
      if (url && /^https?:/i.test(url)) {
        const key = leadKey(url);
        setExistingLead(
          all.find((p) => p.personaId === activePersona.id && leadKey(p.pageUrl) === key) ?? null,
        );
      }
    });
    return unsub;
  }, [activePersona, tabInfo?.url]);

  // Reactive tab detection
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const info = await findProspectTab();
      if (!cancelled) setTabInfo(info);
    }
    void refresh();
    const onActivated = () => void refresh();
    const onUpdated = (
      _id: number,
      change: { url?: string; title?: string; status?: string },
    ) => {
      if (change.url || change.title || change.status === "complete") void refresh();
    };
    const onFocusChanged = () => void refresh();
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.windows.onFocusChanged.addListener(onFocusChanged);
    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.windows.onFocusChanged.removeListener(onFocusChanged);
    };
  }, []);

  /** Resets in-progress workflow state — called when the user switches persona. */
  function resetWorkflow() {
    setBrief(null);
    setSuggestions(null);
    setCustomDraft("");
    setError(null);
  }

  /* ───── analyze flow ───── */
  async function extractFromTab(tabId: number): Promise<ExtractedPageContext> {
    const [injected] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageInPageContext,
    });
    const result = injected?.result as ExtractedPageContext | undefined;
    if (!result || !result.visibleText.trim()) {
      throw new Error(
        "Couldn't read text from this page. Wait for it to load fully (on LinkedIn, scroll once) and try again.",
      );
    }
    return result;
  }

  async function analyzeFlow() {
    if (!settings || !activePersona) return;
    setError(null);
    setBrief(null);
    setSuggestions(null);
    setCustomDraft("");

    try {
      const saved = await getSettings();
      setSettings(saved);
      if (!isOpenAIConfigured(saved)) {
        setTab("settings");
        throw new Error(OPENAI_KEY_REQUIRED_MSG);
      }

      setLoading("Finding prospect tab…");
      const info = await findProspectTab();
      if (!info || !info.isAnalyzable) {
        throw new Error(
          info?.reason ??
            "No analyzable tab. Open the prospect website (or LinkedIn profile) and try again.",
        );
      }
      setTabInfo(info);

      setLoading(`Reading ${tryHostname(info.url)}…`);
      const extracted = await extractFromTab(info.tabId);
      setPage(extracted);

      setLoading(`Scoring against "${activePersona.name}"…`);
      const input: ProspectAnalysisInput = {
        pageUrl: extracted.pageUrl,
        pageTitle: extracted.pageTitle,
        metaDescription: extracted.metaDescription,
        visibleText: extracted.visibleText,
        headings: extracted.headings,
        extractedAt: extracted.extractedAt,
        idealProspectCriteria: activePersona.idealProspectCriteria,
      };
      const prompt = buildProspectBriefPrompt(input, saved);
      const result = await callOpenAI(
        {
          system: prompt.system,
          user: prompt.user,
          schemaName: "prospect_brief",
          schema: briefJsonSchema as unknown as Record<string, unknown>,
          temperature: 0.2,
        },
        saved.openaiApiKey,
        prospectBriefSchema,
      );
      setBrief(result);

      // If already saved → update the existing lead's brief in place.
      const existing = await findProspectByUrl(extracted.pageUrl, activePersona.id);
      if (existing) {
        await upsertProspect({
          personaId: activePersona.id,
          brief: result,
          pageUrl: extracted.pageUrl,
          pageTitle: extracted.pageTitle,
          status: existing.status,
        });
        setExistingLead({ ...existing, brief: result });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(null);
    }
  }

  /* ───── message flow ───── */
  async function generateSuggestions() {
    if (!settings || !brief) return;
    setSuggestLoading(true);
    setError(null);
    try {
      const saved = await getSettings();
      if (!isOpenAIConfigured(saved)) {
        setTab("settings");
        throw new Error(OPENAI_KEY_REQUIRED_MSG);
      }
      const prompt = buildMessageSuggestionsPrompt(brief, saved);
      const result = await callOpenAI(
        {
          system: prompt.system,
          user: prompt.user,
          schemaName: "message_suggestions",
          schema: messagesJsonSchema as unknown as Record<string, unknown>,
          temperature: 0.7,
        },
        saved.openaiApiKey,
        messageSuggestionsSchema,
      );
      setSuggestions(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate messages");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function polishDraft(text: string, mode: PolishMode): Promise<string | null> {
    if (!settings) return null;
    setError(null);
    try {
      const saved = await getSettings();
      if (!isOpenAIConfigured(saved)) {
        setTab("settings");
        throw new Error(OPENAI_KEY_REQUIRED_MSG);
      }
      const prompt = buildPolishPrompt(text, mode, saved);
      const result = await callOpenAI(
        {
          system: prompt.system,
          user: prompt.user,
          schemaName: "polished_message",
          schema: polishJsonSchema as unknown as Record<string, unknown>,
          temperature: mode === "fix_grammar" ? 0 : 0.4,
        },
        saved.openaiApiKey,
        polishedMessageSchema,
      );
      return result.text;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Polish failed");
      return null;
    }
  }

  async function persistLead(status: LeadStatus, message?: { text: string; style: MessageStyle }) {
    if (!brief || !activePersona) return null;
    const pageUrl = page?.pageUrl ?? existingLead?.pageUrl ?? "manual://input";
    const pageTitle = page?.pageTitle ?? existingLead?.pageTitle ?? brief.companyName;

    const { prospect, created } = await upsertProspect({
      personaId: activePersona.id,
      brief,
      pageUrl,
      pageTitle,
      status,
      finalMessage: message?.text,
      finalMessageStyle: message?.style,
    });
    setExistingLead(prospect);
    const all = await getSavedProspects();
    setSavedCountForPersona(all.filter((p) => p.personaId === activePersona.id).length);
    return { prospect, created };
  }

  async function copyAndSave(text: string, style: MessageStyle) {
    if (!brief) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      /* Chrome blocked clipboard access. copied stays false. */
    }
    const result = await persistLead("contacted", { text, style });
    if (!result) {
      flash(copied ? "Copied, but the lead could not be saved" : "Couldn't copy or save");
      return;
    }
    if (!copied) {
      flash(result.created ? "Saved, but the browser blocked copying" : "Updated, but the browser blocked copying");
      return;
    }
    setCopyToast(style);
    setTimeout(() => setCopyToast(null), 1800);
    flash(result.created ? "Copied & saved as new lead" : "Copied & updated existing lead");
  }

  async function saveOnly() {
    const result = await persistLead("saved");
    flash(result?.created ? "Saved" : "Already saved — updated brief");
  }

  function flash(msg: string) {
    setTransientToast(msg);
    setTimeout(() => setTransientToast(null), 1600);
  }

  function openLeadsPage() {
    void chrome.tabs.create({ url: chrome.runtime.getURL("src/leads/index.html") });
  }

  const headerSubline = useMemo(() => {
    if (loading) return loading;
    if (brief) return `${brief.companyName} · ${brief.matchScore}/100`;
    if (tabInfo?.isAnalyzable) return tryHostname(tabInfo.url);
    return "Open a prospect page to begin";
  }, [loading, brief, tabInfo]);

  if (!settings || !activePersona) {
    return (
      <div className="p-4">
        <SkeletonLine />
      </div>
    );
  }

  const apiReady = isOpenAIConfigured(settings);

  return (
    <div className="min-h-screen px-3 py-3.5">
      {/* ── Header ────────────────────────────── */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-xl shrink-0" style={{ background: "var(--accent-grad)", boxShadow: "var(--shadow-glow)" }}>
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-[13px] font-semibold tracking-tight">
              Lead<span className="gradient-text">Brief</span>
            </p>
            <p className="text-[10.5px] truncate" style={{ color: "var(--text-muted)" }}>{headerSubline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <PersonaSwitcher
            personas={settings.personas}
            activePersonaId={settings.activePersonaId}
            onChange={async (id) => {
              if (id === settings.activePersonaId) return;
              const next = { ...settings, activePersonaId: id };
              setSettings(next);
              resetWorkflow();
              await saveSettings(next);
              setSettingsRevision((r) => r + 1);
            }}
          />
          <button onClick={openLeadsPage} className="btn-ghost h-8 px-2 text-[11px]" title="Open Leads page">
            <Inbox size={13} />
            <span className="tabular-nums">{savedCountForPersona}</span>
            <ArrowRight size={11} />
          </button>
        </div>
      </header>

      {/* ── Tab nav ────────────────────────────── */}
      <nav className="mb-3 grid grid-cols-3 gap-1 surface p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-all",
              tab === id ? "" : "hover:text-[var(--text)]",
            )}
            style={
              tab === id
                ? { background: "var(--surface-tint)", color: "var(--text)", boxShadow: "inset 0 0 0 1px var(--border)" }
                : { color: "var(--text-muted)" }
            }
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </nav>

      {/* ── Errors ────────────────────────────── */}
      {error ? (
        <Card className="mb-3" style={{ borderColor: "rgba(225,29,72,0.25)", background: "rgba(225,29,72,0.05)" }}>
          <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--bad)" }}>{error}</p>
        </Card>
      ) : null}

      {/* ── ANALYZE ────────────────────────────── */}
      {tab === "analyze" ? (
        <div className="space-y-3">
          {!apiReady ? (
            <Card style={{ borderColor: "rgba(180,83,9,0.35)", background: "rgba(180,83,9,0.06)" }}>
              <div className="flex items-start gap-2.5">
                <KeyRound size={14} className="mt-0.5 shrink-0" style={{ color: "var(--warn)" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
                    OpenAI API key required
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Add your key in Settings and click Save settings before analyzing.
                  </p>
                  <button
                    onClick={() => setTab("settings")}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-2"
                    style={{ color: "var(--accent)" }}
                  >
                    Go to Settings <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            </Card>
          ) : null}

          {/* Active tab */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="label flex items-center gap-1.5">
                  <StatusDot tone={tabInfo?.isAnalyzable ? "good" : "warn"} />
                  Active tab
                </p>
                <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                  {tabInfo?.title ?? "Detecting…"}
                </p>
                <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {tabInfo?.url ? tryHostname(tabInfo.url) : "—"}
                </p>
                {tabInfo && !tabInfo.isAnalyzable ? (
                  <p className="mt-1.5 text-[11px]" style={{ color: "var(--warn)" }}>{tabInfo.reason}</p>
                ) : null}
              </div>
              <ExternalLink size={13} className="mt-0.5 shrink-0" style={{ color: "var(--text-faint)" }} />
            </div>
          </Card>

          {/* Already saved indicator — dedupe heads-up */}
          {existingLead && tabInfo?.isAnalyzable ? (
            <Card style={{ borderColor: "rgba(91,110,255,0.3)", background: "rgba(91,110,255,0.05)" }}>
              <div className="flex items-start gap-2.5">
                <BookmarkCheck size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-medium" style={{ color: "var(--text)" }}>
                    Already in <span className="gradient-text">{activePersona.name}</span> · status{" "}
                    <span className="font-semibold">{existingLead.status.replace("_", " ")}</span>
                  </p>
                  <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                    Re-analyzing will update this lead in place — no duplicate created.
                  </p>
                </div>
                <button onClick={openLeadsPage} className="btn-ghost !p-1.5 text-[11px]">
                  Open
                </button>
              </div>
            </Card>
          ) : null}

          <Button
            variant="primary"
            className="w-full"
            disabled={!tabInfo?.isAnalyzable || !!loading || !apiReady}
            loading={!!loading}
            onClick={() => void analyzeFlow()}
          >
            {loading
              ? loading
              : !apiReady
                ? "Add API key in Settings"
                : existingLead
                  ? "Re-analyze prospect"
                  : "Analyze prospect"}
          </Button>

          {brief ? (
            <>
              <BriefView brief={brief} />
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => void saveOnly()}>
                  <BookmarkCheck size={13} />
                  Save lead
                </Button>
                <Button variant="primary" onClick={() => setTab("message")}>
                  Compose
                  <ArrowRight size={13} />
                </Button>
              </div>
            </>
          ) : null}

          {!brief && !loading ? (
            <Card>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Click <span style={{ color: "var(--text)" }} className="font-medium">Analyze prospect</span> to score this page against your{" "}
                <button
                  onClick={() => setTab("settings")}
                  className="underline decoration-dotted underline-offset-2"
                  style={{ color: "var(--text)" }}
                >
                  {activePersona.name}
                </button>{" "}
                criteria.
              </p>
            </Card>
          ) : null}

          <p className="text-[10.5px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
            {AI_LIMITATION_NOTE}
          </p>
        </div>
      ) : null}

      {/* ── MESSAGE ────────────────────────────── */}
      {tab === "message" ? (
        brief ? (
          <div className="space-y-3">
            {!apiReady ? (
              <Card style={{ borderColor: "rgba(180,83,9,0.35)", background: "rgba(180,83,9,0.06)" }}>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Add your OpenAI API key in Settings before generating messages.
                </p>
                <button
                  onClick={() => setTab("settings")}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium underline underline-offset-2"
                  style={{ color: "var(--accent)" }}
                >
                  Go to Settings <ArrowRight size={11} />
                </button>
              </Card>
            ) : null}
            <MessageStudio
              aiEnabled={apiReady}
              suggestions={suggestions}
              loading={suggestLoading}
              customDraft={customDraft}
              onCustomDraftChange={setCustomDraft}
              onGenerateSuggestions={() => void generateSuggestions()}
              onPolish={polishDraft}
              onCopy={(text, style) => void copyAndSave(text, style)}
              copyToast={copyToast}
            />
          </div>
        ) : (
          <Card>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Run an analysis first.
              <br />
              <button
                onClick={() => setTab("analyze")}
                className="mt-2 inline-flex items-center gap-1 underline decoration-dotted underline-offset-2"
                style={{ color: "var(--text)" }}
              >
                Go to Analyze <ArrowRight size={11} />
              </button>
            </p>
          </Card>
        )
      ) : null}

      {/* ── SETTINGS ────────────────────────────── */}
      {tab === "settings" ? (
        <SettingsView
          key={settingsRevision}
          settings={settings}
          onSave={async (next) => {
            await saveSettings(next);
            setSettings(await getSettings());
            setSettingsRevision((r) => r + 1);
          }}
          onDeletePersona={async (deletedId, fallbackId, nextSettings) => {
            await Promise.all([saveSettings(nextSettings), reassignProspects(deletedId, fallbackId)]);
            setSettings(await getSettings());
          }}
        />
      ) : null}

      {/* Transient toasts */}
      {transientToast ? <Toast>{transientToast}</Toast> : null}
    </div>
  );
}

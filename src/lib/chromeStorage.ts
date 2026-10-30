import type { LeadStatus, ProspectBrief, SavedProspect } from "../types/prospect";
import type { MessageStyle } from "../types/message";
import type { Persona, Settings } from "../types/settings";
import {
  DEFAULT_PERSONA_ID,
  DEFAULT_SETTINGS,
  LEGACY_KEYS,
  STORAGE_KEYS,
} from "./constants";

/* ────────────────────────────────────────────────────────────────────────
 * SETTINGS
 * ─────────────────────────────────────────────────────────────────────── */

export async function getSettings(): Promise<Settings> {
  const res = await chrome.storage.local.get([STORAGE_KEYS.settings, LEGACY_KEYS.settings]);
  let stored = res[STORAGE_KEYS.settings] as Partial<Settings> | undefined;

  // One-time migration from v2 (single criteria string) to v3 (personas[]).
  if (!stored && res[LEGACY_KEYS.settings]) {
    const legacy = res[LEGACY_KEYS.settings] as {
      senderName?: string;
      companyName?: string;
      signature?: string;
      idealProspectCriteria?: string;
      messageLanguage?: Settings["messageLanguage"];
      openaiApiKey?: string;
    };
    stored = {
      senderName: legacy.senderName,
      companyName: legacy.companyName,
      signature: legacy.signature,
      messageLanguage: legacy.messageLanguage,
      openaiApiKey: legacy.openaiApiKey,
      personas: legacy.idealProspectCriteria
        ? [{ id: DEFAULT_PERSONA_ID, name: "Default", idealProspectCriteria: legacy.idealProspectCriteria }]
        : DEFAULT_SETTINGS.personas,
      activePersonaId: DEFAULT_PERSONA_ID,
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: stored });
  }

  const merged: Settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  // Safety: always at least one persona, activePersonaId must exist in list.
  if (!merged.personas || merged.personas.length === 0) {
    merged.personas = DEFAULT_SETTINGS.personas;
    merged.activePersonaId = DEFAULT_SETTINGS.activePersonaId;
  }
  if (!merged.personas.some((p) => p.id === merged.activePersonaId)) {
    merged.activePersonaId = merged.personas[0].id;
  }
  return merged;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

export function getActivePersona(settings: Settings): Persona {
  return settings.personas.find((p) => p.id === settings.activePersonaId) ?? settings.personas[0];
}

/* ────────────────────────────────────────────────────────────────────────
 * PROSPECTS
 * ─────────────────────────────────────────────────────────────────────── */

export async function getSavedProspects(): Promise<SavedProspect[]> {
  const res = await chrome.storage.local.get([STORAGE_KEYS.prospects, LEGACY_KEYS.prospects]);
  let stored = res[STORAGE_KEYS.prospects] as SavedProspect[] | undefined;

  // Migrate legacy prospects (no personaId) → assign to default persona.
  if (!stored && res[LEGACY_KEYS.prospects]) {
    const legacy = res[LEGACY_KEYS.prospects] as Array<Omit<SavedProspect, "personaId"> & { personaId?: string }>;
    stored = legacy.map((p) => ({ ...p, personaId: p.personaId ?? DEFAULT_PERSONA_ID }));
    await chrome.storage.local.set({ [STORAGE_KEYS.prospects]: stored });
  }

  return (stored ?? []).map((p) => (p.personaId ? p : { ...p, personaId: DEFAULT_PERSONA_ID }));
}

/**
 * Stable lookup key: hostname + path (ignores query/hash/protocol differences).
 * Used to detect duplicates so re-analyzing the same page updates the existing lead.
 */
export function leadKey(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return pageUrl.toLowerCase();
  }
}

export async function findProspectByUrl(
  pageUrl: string,
  personaId: string,
): Promise<SavedProspect | null> {
  const key = leadKey(pageUrl);
  const all = await getSavedProspects();
  return all.find((p) => p.personaId === personaId && leadKey(p.pageUrl) === key) ?? null;
}

/**
 * Idempotent save:
 * - If a lead with the same (personaId + leadKey) exists → update brief, message, status.
 * - Otherwise create a new lead.
 *
 * Returns the resulting SavedProspect (with a stable id).
 */
export async function upsertProspect(input: {
  personaId: string;
  brief: ProspectBrief;
  pageUrl: string;
  pageTitle: string;
  finalMessage?: string;
  finalMessageStyle?: MessageStyle;
  status: LeadStatus;
}): Promise<{ prospect: SavedProspect; created: boolean }> {
  const now = new Date().toISOString();
  const all = await getSavedProspects();
  const key = leadKey(input.pageUrl);
  const existingIndex = all.findIndex(
    (p) => p.personaId === input.personaId && leadKey(p.pageUrl) === key,
  );

  let prospect: SavedProspect;
  let created = false;

  if (existingIndex >= 0) {
    const existing = all[existingIndex];
    prospect = {
      ...existing,
      brief: input.brief,
      pageUrl: input.pageUrl,
      pageTitle: input.pageTitle,
      // Don't downgrade status. e.g. once "responded" stays "responded".
      status: rankStatus(input.status) > rankStatus(existing.status) ? input.status : existing.status,
      finalMessage: input.finalMessage ?? existing.finalMessage,
      finalMessageStyle: input.finalMessageStyle ?? existing.finalMessageStyle,
      updatedAt: now,
    };
    all[existingIndex] = prospect;
    // Move to top
    all.splice(existingIndex, 1);
    all.unshift(prospect);
  } else {
    prospect = {
      id: crypto.randomUUID(),
      personaId: input.personaId,
      brief: input.brief,
      pageUrl: input.pageUrl,
      pageTitle: input.pageTitle,
      finalMessage: input.finalMessage,
      finalMessageStyle: input.finalMessageStyle,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    all.unshift(prospect);
    created = true;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.prospects]: all });
  return { prospect, created };
}

function rankStatus(s: LeadStatus): number {
  return { saved: 0, contacted: 1, follow_up: 2, responded: 3 }[s];
}

function mergeNotes(a?: string, b?: string): string | undefined {
  const left = a?.trim();
  const right = b?.trim();
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  return `${left}\n\n---\n\n${right}`;
}

/** Merge two records for the same URL within one persona (e.g. when reassigning leads). */
function mergeProspectRecords(existing: SavedProspect, incoming: SavedProspect): SavedProspect {
  const now = new Date().toISOString();
  const status =
    rankStatus(incoming.status) > rankStatus(existing.status) ? incoming.status : existing.status;
  const incomingNewer =
    new Date(incoming.updatedAt).getTime() >= new Date(existing.updatedAt).getTime();

  return {
    ...existing,
    brief: incomingNewer ? incoming.brief : existing.brief,
    pageUrl: incoming.pageUrl,
    pageTitle: incoming.pageTitle,
    status,
    finalMessage: incoming.finalMessage ?? existing.finalMessage,
    finalMessageStyle: incoming.finalMessageStyle ?? existing.finalMessageStyle,
    followUpAt: status === "follow_up" ? (incoming.followUpAt ?? existing.followUpAt) : undefined,
    notes: mergeNotes(existing.notes, incoming.notes),
    updatedAt: now,
  };
}

export async function updateProspect(id: string, updates: Partial<SavedProspect>): Promise<void> {
  const all = await getSavedProspects();
  await chrome.storage.local.set({
    [STORAGE_KEYS.prospects]: all.map((item) =>
      item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item,
    ),
  });
}

export async function setStatus(id: string, status: LeadStatus, followUpAt?: string): Promise<void> {
  await updateProspect(id, { status, followUpAt: status === "follow_up" ? followUpAt : undefined });
}

export async function deleteProspect(id: string): Promise<void> {
  const all = await getSavedProspects();
  await chrome.storage.local.set({
    [STORAGE_KEYS.prospects]: all.filter((item) => item.id !== id),
  });
}

/** When personas are deleted, reassign their leads to the fallback persona (merging duplicates). */
export async function reassignProspects(fromPersonaId: string, toPersonaId: string): Promise<void> {
  const all = await getSavedProspects();
  const moving = all.filter((p) => p.personaId === fromPersonaId);
  const rest = all.filter((p) => p.personaId !== fromPersonaId);

  for (const lead of moving) {
    const moved: SavedProspect = { ...lead, personaId: toPersonaId };
    const key = leadKey(lead.pageUrl);
    const existingIndex = rest.findIndex(
      (p) => p.personaId === toPersonaId && leadKey(p.pageUrl) === key,
    );
    if (existingIndex >= 0) {
      rest[existingIndex] = mergeProspectRecords(rest[existingIndex], moved);
    } else {
      rest.unshift(moved);
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.prospects]: rest });
}

export function onProspectsChanged(callback: (prospects: SavedProspect[]) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== "local" || !changes[STORAGE_KEYS.prospects]) return;
    callback((changes[STORAGE_KEYS.prospects].newValue as SavedProspect[] | undefined) ?? []);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== "local" || !changes[STORAGE_KEYS.settings]) return;
    const next = changes[STORAGE_KEYS.settings].newValue as Settings | undefined;
    if (next) callback({ ...DEFAULT_SETTINGS, ...next });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

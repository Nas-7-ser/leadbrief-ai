import type { Settings } from "../types/settings";

export const STORAGE_KEYS = {
  settings: "leadbrief_settings_v3",
  prospects: "leadbrief_prospects_v3",
} as const;

export const LEGACY_KEYS = {
  settings: "leadbrief_settings_v2",
  prospects: "leadbrief_prospects_v2",
} as const;

export const DEFAULT_PERSONA_ID = "default";

export const OPENAI_MODEL = "gpt-4.1-mini";

export const DEFAULT_SETTINGS: Settings = {
  senderName: "",
  companyName: "",
  signature: "",
  personas: [
    {
      id: DEFAULT_PERSONA_ID,
      name: "Default",
      idealProspectCriteria:
        "I sell AI visibility audits to French law firms.\n\nIdeal prospect:\n- Small/mid-size cabinet (2–30 lawyers)\n- Clear practice area (corporate, tax, IP, real-estate, business law)\n- Has a public website\n- Decision-maker visible (founding partner, associate)\n\nDeal-breakers: solo generalists, very large firms with in-house marketing, pure litigation with no business clients.",
    },
  ],
  activePersonaId: DEFAULT_PERSONA_ID,
  messageLanguage: "auto",
};

export const AI_LIMITATION_NOTE =
  "Brief is based only on the current visible page. No live search, LinkedIn API, CRM or enrichment data is used.";

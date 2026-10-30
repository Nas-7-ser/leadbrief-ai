export type Recommendation = "contact" | "maybe" | "skip";

export type ProspectAnalysisInput = {
  pageUrl: string;
  pageTitle: string;
  metaDescription?: string;
  visibleText: string;
  headings?: string[];
  extractedAt: string;
  idealProspectCriteria: string;
};

export type ProspectBrief = {
  companyName: string;
  sectorOrRole: string;
  location: string | null;
  decisionMaker: string | null;
  matchScore: number;
  recommendation: Recommendation;
  matchReason: string;
  signals: string[];
  angle: string;
  personalizationHook: string;
};

export type LeadStatus = "saved" | "contacted" | "follow_up" | "responded";

export type SavedProspect = {
  id: string;
  /** Which persona this lead belongs to. Lead lists are scoped by personaId. */
  personaId: string;
  brief: ProspectBrief;
  pageUrl: string;
  pageTitle: string;
  finalMessage?: string;
  finalMessageStyle?: import("./message").MessageStyle;
  status: LeadStatus;
  followUpAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

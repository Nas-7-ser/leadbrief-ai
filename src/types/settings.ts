export type MessageLanguage = "auto" | "english" | "french";

/** A targeting profile: ideal prospect criteria + its own lead list. */
export type Persona = {
  id: string;
  name: string;
  idealProspectCriteria: string;
};

export type Settings = {
  senderName: string;
  companyName: string;
  signature: string;
  personas: Persona[];
  activePersonaId: string;
  messageLanguage: MessageLanguage;
  openaiApiKey?: string;
};

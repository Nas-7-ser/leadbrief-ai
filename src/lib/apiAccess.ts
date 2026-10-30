import type { Settings } from "../types/settings";

/** True when the user has saved a non-empty OpenAI API key (required for all AI features). */
export function isOpenAIConfigured(settings: Settings): boolean {
  return Boolean(settings.openaiApiKey?.trim());
}

/** User-facing message when AI features are blocked. */
export const OPENAI_KEY_REQUIRED_MSG =
  "Add your OpenAI API key in Settings, click Save settings, then try again.";

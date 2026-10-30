export type MessageStyle = "professional" | "casual" | "subtle" | "custom";

/** AI returns three short variations in one call. */
export type MessageSuggestions = {
  professional: string;
  casual: string;
  subtle: string;
};

export type PolishMode = "fix_grammar" | "improve";

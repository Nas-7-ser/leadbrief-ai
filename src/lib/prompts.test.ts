import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "./constants";
import { buildMessageSuggestionsPrompt, buildProspectBriefPrompt } from "./prompts";
import type { ProspectBrief } from "../types/prospect";

const SECRET = "unit-test-key-must-stay-out-of-prompts";

const brief: ProspectBrief = {
  companyName: "Acme",
  sectorOrRole: "Law firm",
  location: "Paris",
  decisionMaker: null,
  matchScore: 80,
  recommendation: "contact",
  matchReason: "Strong fit.",
  signals: ["Tax page"],
  angle: "Ask about the tax page.",
  personalizationHook: "Saw the tax page.",
};

const settings = {
  ...DEFAULT_SETTINGS,
  senderName: "Jane",
  companyName: "Acme",
  openaiApiKey: SECRET,
};

describe("prompts", () => {
  it("includes the persona criteria and page headings, and never the API key", () => {
    const prompt = buildProspectBriefPrompt(
      {
        pageUrl: "https://example.com",
        pageTitle: "Example",
        visibleText: "We advise on tax.",
        headings: ["Tax practice"],
        extractedAt: "2026-01-01T00:00:00.000Z",
        idealProspectCriteria: "French tax boutiques",
      },
      settings,
    );
    const text = `${prompt.system}\n${prompt.user}`;
    assert.match(text, /French tax boutiques/);
    assert.match(text, /Tax practice/);
    assert.equal(text.includes(SECRET), false);
  });

  it("keeps the API key out of message prompts", () => {
    const prompt = buildMessageSuggestionsPrompt(brief, settings);
    const text = `${prompt.system}\n${prompt.user}`;
    assert.match(text, /Jane/);
    assert.equal(text.includes(SECRET), false);
  });
});

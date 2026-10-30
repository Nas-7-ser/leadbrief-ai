import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "./constants";
import { isOpenAIConfigured } from "./apiAccess";

describe("OpenAI key gate", () => {
  it("accepts only a saved non-empty key", () => {
    assert.equal(isOpenAIConfigured(DEFAULT_SETTINGS), false);
    assert.equal(isOpenAIConfigured({ ...DEFAULT_SETTINGS, openaiApiKey: "   " }), false);
    assert.equal(isOpenAIConfigured({ ...DEFAULT_SETTINGS, openaiApiKey: "present" }), true);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { messageSuggestionsSchema, polishedMessageSchema, prospectBriefSchema } from "./schemas";

const validBrief = {
  companyName: "Acme",
  sectorOrRole: "Law firm",
  location: "Paris",
  decisionMaker: "Ada — Partner",
  matchScore: 82,
  recommendation: "contact",
  matchReason: "Matches the criteria.",
  signals: ["Tax page is public"],
  angle: "Mention the tax page.",
  personalizationHook: "Your tax practice page is public.",
};

describe("AI response schemas", () => {
  it("accepts a complete brief and rejects a bad score or recommendation", () => {
    assert.equal(prospectBriefSchema.safeParse(validBrief).success, true);
    assert.equal(prospectBriefSchema.safeParse({ ...validBrief, matchScore: 140 }).success, false);
    assert.equal(prospectBriefSchema.safeParse({ ...validBrief, matchScore: -1 }).success, false);
    assert.equal(prospectBriefSchema.safeParse({ ...validBrief, recommendation: "later" }).success, false);
  });

  it("requires all three message styles and a polished text field", () => {
    assert.equal(
      messageSuggestionsSchema.safeParse({ professional: "a", casual: "b", subtle: "c" }).success,
      true,
    );
    assert.equal(messageSuggestionsSchema.safeParse({ professional: "a" }).success, false);
    assert.equal(polishedMessageSchema.safeParse({ text: "Fixed." }).success, true);
    assert.equal(polishedMessageSchema.safeParse({}).success, false);
  });
});

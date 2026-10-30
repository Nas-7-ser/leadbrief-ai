import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { ProspectBrief, SavedProspect } from "../types/prospect";
import { getSavedProspects, leadKey, reassignProspects, upsertProspect } from "./chromeStorage";
import { STORAGE_KEYS } from "./constants";

const memory: Record<string, unknown> = {};

function installChrome() {
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        async get(keys?: string | string[] | null) {
          const list = keys == null ? Object.keys(memory) : Array.isArray(keys) ? keys : [keys];
          const out: Record<string, unknown> = {};
          for (const key of list) {
            if (Object.prototype.hasOwnProperty.call(memory, key)) out[key] = memory[key];
          }
          return out;
        },
        async set(items: Record<string, unknown>) {
          Object.assign(memory, items);
        },
      },
      onChanged: {
        addListener() {},
        removeListener() {},
      },
    },
  };
}

function brief(score = 80): ProspectBrief {
  return {
    companyName: "Acme",
    sectorOrRole: "Law firm",
    location: "Paris",
    decisionMaker: "Ada — Partner",
    matchScore: score,
    recommendation: score >= 80 ? "contact" : score >= 50 ? "maybe" : "skip",
    matchReason: "Checked against the persona.",
    signals: ["Public site"],
    angle: "Mention the practice page.",
    personalizationHook: "Your practice page is public.",
  };
}

beforeEach(() => {
  for (const key of Object.keys(memory)) delete memory[key];
  installChrome();
});

describe("lead identity", () => {
  it("treats the same page as one lead across www, trailing slash, and query", () => {
    const key = leadKey("https://www.linkedin.com/in/Ada/");
    assert.equal(key, leadKey("https://linkedin.com/in/Ada"));
    assert.equal(key, leadKey("https://linkedin.com/in/Ada?trk=public"));
  });
});

describe("upsertProspect", () => {
  it("updates the existing lead and never downgrades status", async () => {
    const first = await upsertProspect({
      personaId: "default",
      brief: brief(90),
      pageUrl: "https://www.linkedin.com/in/Ada/",
      pageTitle: "Ada",
      status: "responded",
      finalMessage: "Hello",
      finalMessageStyle: "professional",
    });
    assert.equal(first.created, true);

    const second = await upsertProspect({
      personaId: "default",
      brief: brief(40),
      pageUrl: "https://linkedin.com/in/Ada?trk=public",
      pageTitle: "Ada updated",
      status: "saved",
    });

    assert.equal(second.created, false);
    assert.equal(second.prospect.id, first.prospect.id);
    assert.equal(second.prospect.status, "responded");
    assert.equal(second.prospect.finalMessage, "Hello");
    assert.equal(second.prospect.brief.matchScore, 40);
    assert.equal((await getSavedProspects()).length, 1);
  });

  it("can move a lead forward and replace the saved message", async () => {
    await upsertProspect({
      personaId: "default",
      brief: brief(),
      pageUrl: "https://example.com",
      pageTitle: "Example",
      status: "saved",
    });
    const next = await upsertProspect({
      personaId: "default",
      brief: brief(),
      pageUrl: "https://example.com",
      pageTitle: "Example",
      status: "contacted",
      finalMessage: "New note",
      finalMessageStyle: "casual",
    });
    assert.equal(next.created, false);
    assert.equal(next.prospect.status, "contacted");
    assert.equal(next.prospect.finalMessage, "New note");
  });
});

describe("reassignProspects", () => {
  it("merges two leads for the same page and keeps the stronger status", async () => {
    const target: SavedProspect = {
      id: "b",
      personaId: "persona-b",
      brief: brief(90),
      pageUrl: "https://example.com/about",
      pageTitle: "About",
      status: "responded",
      notes: "from B",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const moving: SavedProspect = {
      id: "a",
      personaId: "persona-a",
      brief: brief(50),
      pageUrl: "https://www.example.com/about/",
      pageTitle: "About",
      status: "contacted",
      notes: "from A",
      finalMessage: "Hi there",
      finalMessageStyle: "casual",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };
    memory[STORAGE_KEYS.prospects] = [target, moving];

    await reassignProspects("persona-a", "persona-b");
    const all = await getSavedProspects();

    assert.equal(all.length, 1);
    assert.equal(all[0].personaId, "persona-b");
    assert.equal(all[0].status, "responded");
    assert.equal(all[0].finalMessage, "Hi there");
    assert.equal(all[0].brief.matchScore, 50);
    assert.match(all[0].notes ?? "", /from B/);
    assert.match(all[0].notes ?? "", /from A/);
  });
});

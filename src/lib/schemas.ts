import { z } from "zod";

const score = z.coerce.number().min(0).max(100);

export const prospectBriefSchema = z.object({
  companyName: z.string(),
  sectorOrRole: z.string(),
  location: z.string().nullable(),
  decisionMaker: z.string().nullable(),
  matchScore: score,
  recommendation: z.enum(["contact", "maybe", "skip"]),
  matchReason: z.string(),
  signals: z.array(z.string()),
  angle: z.string(),
  personalizationHook: z.string(),
});

export const messageSuggestionsSchema = z.object({
  professional: z.string(),
  casual: z.string(),
  subtle: z.string(),
});

export const polishedMessageSchema = z.object({
  text: z.string(),
});

/** JSON-Schema mirrors for OpenAI structured outputs. */

export const briefJsonSchema = {
  type: "object",
  properties: {
    companyName: { type: "string" },
    sectorOrRole: { type: "string" },
    location: { type: ["string", "null"] },
    decisionMaker: { type: ["string", "null"] },
    matchScore: { type: "number" },
    recommendation: { type: "string", enum: ["contact", "maybe", "skip"] },
    matchReason: { type: "string" },
    signals: { type: "array", items: { type: "string" } },
    angle: { type: "string" },
    personalizationHook: { type: "string" },
  },
  required: [
    "companyName",
    "sectorOrRole",
    "location",
    "decisionMaker",
    "matchScore",
    "recommendation",
    "matchReason",
    "signals",
    "angle",
    "personalizationHook",
  ],
  additionalProperties: false,
} as const;

export const messagesJsonSchema = {
  type: "object",
  properties: {
    professional: { type: "string" },
    casual: { type: "string" },
    subtle: { type: "string" },
  },
  required: ["professional", "casual", "subtle"],
  additionalProperties: false,
} as const;

export const polishJsonSchema = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
} as const;

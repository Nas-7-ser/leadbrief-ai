import type { PolishMode } from "../types/message";
import type { ProspectAnalysisInput, ProspectBrief } from "../types/prospect";
import type { Settings } from "../types/settings";

/** ───────────────────────────────────────────────────────────────────────
 * BRIEF PROMPT — produces a compact, opinionated brief scored ONLY against
 * the user's free-text "ideal prospect" criteria.
 * ─────────────────────────────────────────────────────────────────────── */
export function buildProspectBriefPrompt(input: ProspectAnalysisInput, settings: Settings) {
  const isLinkedIn = /linkedin\.com/i.test(input.pageUrl);
  const linkedinHint = isLinkedIn
    ? input.pageUrl.includes("/in/")
      ? "This is a LinkedIn personal profile. companyName = the firm/employer they work at. decisionMaker = their full name + current title."
      : input.pageUrl.includes("/company/")
        ? "This is a LinkedIn company page. companyName = the company itself. decisionMaker = null unless a leader is clearly named."
        : "This is a LinkedIn page."
    : "This is a regular website. Identify the company, its sector, its location, and the most likely decision maker if visible.";

  const criteria =
    input.idealProspectCriteria.trim() || "(user did not provide criteria — score based on general B2B fit)";

  return {
    system: `You are a senior B2B sales analyst. You read the visible content of a single web page and return a short, honest, opinionated brief about whether this prospect is worth contacting.

You score ONLY against the user's own "ideal prospect" criteria. The match score reflects how well this specific prospect matches that ideal — nothing else.

Hard rules:
- Only use the visible page content. Never invent facts. Never claim to have searched the web, LinkedIn, CRMs, or anything external.
- If something isn't visible, say so honestly (use "Unknown" or null).
- Phrase pain/weakness signals as observations ("appears to", "may suggest").
- Be concise. Every field is short. No corporate fluff.
- Always return valid JSON matching the schema.`,
    user: `## User's ideal prospect criteria
"""
${criteria}
"""

## Page context
URL: ${input.pageUrl}
Title: ${input.pageTitle}
Meta description: ${input.metaDescription ?? "n/a"}

${linkedinHint}

## Headings visible on the page
${formatHeadings(input.headings)}

## Sender (you, not the prospect)
${settings.senderName || "Unknown sender"} from ${settings.companyName || "Unknown company"}

## Field rules
- companyName: the prospect's company/firm. If a person, the firm they work at.
- sectorOrRole: short label, e.g. "Cabinet d'avocats — droit des affaires" or "SEO agency — local SMBs" or "Senior Counsel — corporate law".
- location: city/country if visible, else null.
- decisionMaker: "Full Name — Title" if visible, else null. Never invent.
- matchScore: 0–100 integer. ONLY measures fit with the criteria above.
    • 80–100 = strong match → recommendation = "contact"
    • 50–79 = partial match → "maybe"
    • 0–49 = weak match → "skip"
- matchReason: 1–2 sentences explaining the score against the criteria. Reference specific things you saw on the page.
- signals: 2–4 short bullets (max 12 words each) — concrete observations from the page (e.g. "Practice page lists droit fiscal & corporate", "No author bios visible", "Has an English version").
- angle: 1–2 sentences — the most specific way to open a conversation, tied to something on the page.
- personalizationHook: ONE sentence the user could literally drop into a message to prove they read the page.

## Visible page content (this is ALL you see)
"""
${input.visibleText}
"""

Return JSON only.`,
  };
}

/** ───────────────────────────────────────────────────────────────────────
 * MESSAGE PROMPT — generates THREE tiny messages (Pro / Casual / Subtle)
 * in one call. Tuned hard against AI clichés.
 * ─────────────────────────────────────────────────────────────────────── */
export function buildMessageSuggestionsPrompt(brief: ProspectBrief, settings: Settings) {
  const lang = pickLanguage(settings.messageLanguage, brief);

  return {
    system: `You write extremely short outreach messages that don't sound like AI.

You will produce THREE versions of the SAME outreach (professional / casual / subtle).
All three must:
- Be 2–3 sentences max. NEVER more than 50 words.
- Sound like a real human sender, not a marketer or chatbot.
- Reference one specific detail from the brief (the personalizationHook or a signal). No fake compliments.
- End with ONE soft, specific question. Not "let me know if interested".
- Be in ${lang}. ${lang === "French" ? "Use 'tu' only if the prospect is clearly a peer; default to 'vous'. Use 'Maître' only if the brief identifies a lawyer by name." : ""}
- NO greeting like "I hope this message finds you well", "I came across your profile and was impressed", "I'd love to connect", "reaching out", "leverage", "synergize", "circle back".
- NO emojis. NO hashtags. NO "—" em-dashes.

Style guide:
- "professional": polite, clear, one capitalized name. Like a B2B founder writing personally. Light formality.
- "casual": warm, conversational, contractions OK, slightly lowercase tone. Like writing to a peer.
- "subtle": low-pressure, curious. Almost like thinking out loud. No sales energy at all.

The three must feel different from each other — not just synonyms.

Return JSON: { professional, casual, subtle }. No markdown.`,
    user: `Sender: ${settings.senderName || "(unsigned)"} from ${settings.companyName || "(no company)"}
Signature line to optionally append: ${settings.signature ? `"${settings.signature}"` : "(none — keep it personal, no formal sign-off)"}

Channel: LinkedIn (so no subject line, no formal sign-off, max ~50 words each).

Brief:
${JSON.stringify(brief, null, 2)}

Generate the three messages now.`,
  };
}

/** ───────────────────────────────────────────────────────────────────────
 * POLISH PROMPT — fixes grammar OR slightly improves the user's draft.
 * Always preserves voice and length.
 * ─────────────────────────────────────────────────────────────────────── */
export function buildPolishPrompt(text: string, mode: PolishMode, settings: Settings) {
  const lang = pickLanguageRaw(settings.messageLanguage, text);
  const instruction =
    mode === "fix_grammar"
      ? `Fix ONLY spelling, grammar, and punctuation. Do NOT change wording, tone, length, or structure. Keep every sentence as the user wrote it.`
      : `Make this message slightly better. Tighten weak words. Remove filler. Keep the user's voice, tone, and intent EXACTLY. Do not lengthen it. Do not make it more formal. Output the improved version only.`;

  return {
    system: `You are an expert copy editor. ${instruction} Always reply in ${lang}. Return JSON: { "text": "..." }.`,
    user: `Original message:
"""
${text}
"""`,
  };
}

function formatHeadings(headings: string[] | undefined): string {
  const list = (headings ?? []).map((heading) => heading.trim()).filter(Boolean).slice(0, 20);
  if (list.length === 0) return "(none detected)";
  return list.map((heading) => `- ${heading}`).join("\n");
}

/* ─── helpers ─── */
function pickLanguage(setting: Settings["messageLanguage"], brief: ProspectBrief): "French" | "English" {
  if (setting === "french") return "French";
  if (setting === "english") return "English";
  const haystack = `${brief.companyName} ${brief.sectorOrRole} ${brief.location ?? ""} ${brief.matchReason}`;
  const frenchHints = /\b(cabinet|avocat|maître|droit|société|france|paris|lyon|marseille|bordeaux)\b/i;
  return frenchHints.test(haystack) ? "French" : "English";
}
function pickLanguageRaw(setting: Settings["messageLanguage"], text: string): "French" | "English" {
  if (setting === "french") return "French";
  if (setting === "english") return "English";
  return /\b(je|vous|nous|cabinet|avocat|bonjour|merci)\b/i.test(text) ? "French" : "English";
}

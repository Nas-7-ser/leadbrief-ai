import { z } from "zod";
import { OPENAI_KEY_REQUIRED_MSG } from "./apiAccess";
import { OPENAI_MODEL } from "./constants";

export async function callOpenAI<T>(
  args: {
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
    temperature?: number;
  },
  openaiApiKey: string | undefined,
  parser: z.ZodType<T>,
): Promise<T> {
  const key = openaiApiKey?.trim();
  if (!key) {
    throw new Error(OPENAI_KEY_REQUIRED_MSG);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: args.schemaName, strict: true, schema: args.schema },
      },
      temperature: args.temperature ?? 0.3,
    }),
  });

  const data: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errObj = data as { error?: { message?: string }; message?: string };
    const msg =
      errObj?.error?.message ??
      errObj?.message ??
      (typeof data === "object" && data !== null ? JSON.stringify(data).slice(0, 280) : "");
    throw new Error(
      msg ? `OpenAI request failed (${response.status}): ${msg}` : `OpenAI request failed (${response.status}).`,
    );
  }

  const completion = data as { choices?: Array<{ message?: { content?: string } }> };
  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error("The AI response was invalid. Try again.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(error, raw);
    throw new Error("Could not parse AI response. Try again.", { cause: error });
  }

  const validated = parser.safeParse(parsed);
  if (!validated.success) {
    console.error(validated.error.flatten());
    const first = validated.error.issues[0];
    const detail = first ? `${first.path.join(".") || "root"}: ${first.message}` : "validation failed";
    throw new Error(`Could not parse AI response (${detail}). Try again.`, { cause: validated.error });
  }

  return validated.data;
}

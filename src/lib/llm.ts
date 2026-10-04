// Live mode: the same pipeline steps the precomputed outputs came from, run against a live model.
// Two providers, picked by which key is set on the server (LLM_PROVIDER can force one):
//   Groq      (GROQ_API_KEY):      fast tier openai/gpt-oss-20b, strong tier openai/gpt-oss-120b
//   Anthropic (ANTHROPIC_API_KEY): fast tier Haiku 4.5, strong tier Sonnet 5.5 (the Step 4 cost estimate)
// Fast tier -> F1 capture/linking triage, F3 brief one-liners. Strong tier -> F2 extraction, F4 drafts.
// Keys are read only from environment variables on the server; never from the browser or a file.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { TODAY } from "./dates";

export type Provider = "groq" | "anthropic";
type Tier = "fast" | "strong";

const MODEL_IDS: Record<Provider, Record<Tier, string>> = {
  groq: {
    fast: process.env.GROQ_MODEL_FAST || "openai/gpt-oss-20b",
    strong: process.env.GROQ_MODEL_STRONG || "openai/gpt-oss-120b",
  },
  anthropic: { fast: "claude-haiku-4-5-20251001", strong: "claude-sonnet-5-5" },
};

export const MAX_SOURCE_CHARS = 8000;

export function provider(): Provider | null {
  const forced = process.env.LLM_PROVIDER;
  if (forced === "groq" && process.env.GROQ_API_KEY) return "groq";
  if (forced === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function liveEnabled(): boolean {
  return provider() !== null;
}

export function models() {
  const p = provider() ?? "anthropic";
  const m = MODEL_IDS[p];
  return { provider: p, capture: m.fast, brief: m.fast, extraction: m.strong, drafts: m.strong };
}

// ---------- provider plumbing ----------

/** Groq's strict JSON-schema mode needs every object closed and every property required. */
function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "$schema") continue;
    out[k] = strictSchema(v);
  }
  if (out.type === "object" && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as object);
  }
  return out;
}

async function groqChat(body: Record<string, unknown>): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${j.error?.message ?? "request failed"}`);
  return j.choices?.[0]?.message?.content ?? "";
}

async function structured<S extends z.ZodType>(tier: Tier, system: string, user: string, schema: S, name: string, maxTokens: number): Promise<z.infer<S>> {
  const p = provider();
  if (!p) throw new Error("Live mode is off: no API key is set on the server.");
  const model = MODEL_IDS[p][tier];
  let raw: unknown;
  if (p === "groq") {
    const content = await groqChat({
      model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema: strictSchema(z.toJSONSchema(schema)) } },
    });
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error("The model's output was not valid JSON.");
    }
  } else {
    const res = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.parse({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(schema) },
    });
    if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
    raw = res.parsed_output;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("The model's output did not match the schema.");
  return parsed.data;
}

async function text(tier: Tier, system: string, user: string, maxTokens: number): Promise<string> {
  const p = provider();
  if (!p) throw new Error("Live mode is off: no API key is set on the server.");
  const model = MODEL_IDS[p][tier];
  if (p === "groq") {
    return (
      await groqChat({
        model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      })
    ).trim();
  }
  const res = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

const GROUNDING =
  "Use only facts stated in the provided AtliQ records. Never invent prices, discounts, dates, scope, names or commitments. " +
  "If something is unknown, leave it out (for extraction) or write [blank: what is missing] (for drafts).";

// ---------- F1: link triage (fast tier) ----------
const LinkSchema = z.object({
  state: z.enum(["confident", "unsure", "new"]),
  accountId: z.string().describe("lead_id of the matching CRM account, or empty when new"),
  newCompany: z.string().describe("company name when state is new, else empty"),
  hasCommitment: z.boolean().describe("true if the text contains any ask, promise, deadline or revisit/referral/cross-sell signal"),
  reason: z.string(),
});
export type LinkResult = z.infer<typeof LinkSchema>;

export async function linkSource(source: string, accounts: { id: string; company: string; contact: string; email: string }[]) {
  const list = accounts.map((a) => `${a.id} | ${a.company} | ${a.contact} | ${a.email}`).join("\n");
  return structured(
    "fast",
    "You link a sales email or meeting note to AtliQ's CRM. Match on contact email, email domain, lead_id and company name. " +
      "If two accounts could match, or the note itself doubts the match, answer unsure. If the company is not in the CRM, answer new. Never guess.",
    `CRM accounts (lead_id | company | contact | email):\n${list}\n\nSource:\n<source>\n${source}\n</source>`,
    LinkSchema,
    "link",
    1024,
  );
}

// ---------- F2: extraction (strong tier) ----------
const ItemSchema = z.object({
  type: z.enum(["ask", "promise", "deadline", "revisit", "cross-sell", "referral", "budget", "stakeholder"]),
  summary: z.string().describe("one line, restating only what the quotes say"),
  owedBy: z.string(),
  owedTo: z.string(),
  arose: z.string().describe("ISO date the item arose"),
  dueText: z.string().describe("the date words used in the source, or empty"),
  dueStart: z.string().describe("ISO earliest plausible due date, or empty"),
  dueEnd: z.string().describe("ISO latest plausible due date, or empty"),
  approximate: z.boolean(),
  restricted: z.enum(["", "SOW", "pricing", "contract terms", "security questionnaire", "proposal"]),
  quotes: z.array(z.string()).describe("verbatim spans copied exactly from the source"),
  confidence: z.number(),
});
const ExtractSchema = z.object({
  items: z.array(ItemSchema),
  crmUpdates: z.array(
    z.object({ field: z.enum(["status", "owner", "est_value_usd", "notes", "service_interest"]), proposed: z.string(), quote: z.string() }),
  ),
});
export type Extraction = z.infer<typeof ExtractSchema>;

export async function extract(source: string, account: string) {
  return structured(
    "strong",
    `You extract AtliQ's sales commitments into a fixed schema. Today is ${TODAY}. ` +
      "Capture client asks needing AtliQ action, promises AtliQ people made, deadlines, revisit dates, referrals, cross-sell hints, budget and stakeholder facts. " +
      "Every item must carry at least one verbatim quote copied character for character from the source; an item without a quote is not allowed. " +
      "Vague dates ('mid-July', 'next week', 'Q2') become a window with approximate=true. " +
      "Mark SOWs, pricing, contract terms, proposals and security questionnaires as restricted. " +
      "Also propose CRM field updates the source supports, each with a verbatim quote. " +
      GROUNDING,
    `Account: ${account}\n\n<source>\n${source}\n</source>`,
    ExtractSchema,
    "extraction",
    16000,
  );
}

// ---------- F4: reply draft (strong tier) ----------
export async function draftReply(input: { account: string; owner: string; ask: string; context: string }) {
  return text(
    "strong",
    "You draft a short, warm reply email for an AtliQ seller to review, edit and send themselves. You never send anything. " +
      "Use only the account context provided; it contains this one client's records and nothing else. " +
      "Answer the open ask. Apologise briefly if AtliQ is late. Sign with the seller's first name. " +
      GROUNDING,
    `Seller: ${input.owner}\nAccount: ${input.account}\nOpen item: ${input.ask}\n\nAccount context:\n<context>\n${input.context}\n</context>\n\nWrite only the email body.`,
    4000,
  );
}

// ---------- F3: brief one-liners (fast tier) ----------
const SummarySchema = z.object({ lines: z.array(z.object({ id: z.string(), line: z.string() })) });

export async function briefLines(items: { id: string; facts: string }[]) {
  return structured(
    "fast",
    "Write one plain-English line per item for a seller's morning brief, under 25 words, starting with the action. " +
      "Restate only the facts given. Do not add dates, amounts or names that are not in the facts.",
    items.map((i) => `${i.id}: ${i.facts}`).join("\n"),
    SummarySchema,
    "brief_lines",
    2048,
  );
}

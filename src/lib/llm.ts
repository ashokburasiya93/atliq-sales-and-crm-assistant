// Live mode: the same pipeline steps the precomputed outputs came from, run against the
// Claude API. Model split follows the Step 4 cost estimate:
//   Haiku 4.5  -> F1 capture/linking triage, F3 brief one-liners
//   Sonnet 5.5 -> F2 extraction (with CRM proposals), F4 reply drafts
// The key is read only from the ANTHROPIC_API_KEY environment variable on the server.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { TODAY } from "./dates";

export const MODELS = {
  capture: "claude-haiku-4-5-20251001",
  brief: "claude-haiku-4-5-20251001",
  extraction: "claude-sonnet-5-5",
  drafts: "claude-sonnet-5-5",
} as const;

export const MAX_SOURCE_CHARS = 8000;

export function liveEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const GROUNDING =
  "Use only facts stated in the provided AtliQ records. Never invent prices, discounts, dates, scope, names or commitments. " +
  "If something is unknown, leave it out (for extraction) or write [blank: what is missing] (for drafts).";

// ---------- F1: link triage (Haiku) ----------
const LinkSchema = z.object({
  state: z.enum(["confident", "unsure", "new"]),
  accountId: z.string().describe("lead_id of the matching CRM account, or empty when new"),
  newCompany: z.string().describe("company name when state is new, else empty"),
  hasCommitment: z.boolean().describe("true if the text contains any ask, promise, deadline or revisit/referral/cross-sell signal"),
  reason: z.string(),
});
export type LinkResult = z.infer<typeof LinkSchema>;

export async function linkSource(text: string, accounts: { id: string; company: string; contact: string; email: string }[]) {
  const list = accounts.map((a) => `${a.id} | ${a.company} | ${a.contact} | ${a.email}`).join("\n");
  const res = await client().messages.parse({
    model: MODELS.capture,
    max_tokens: 1024,
    system:
      "You link a sales email or meeting note to AtliQ's CRM. Match on contact email, email domain, lead_id and company name. " +
      "If two accounts could match, or the note itself doubts the match, answer unsure. If the company is not in the CRM, answer new. Never guess.",
    messages: [{ role: "user", content: `CRM accounts (lead_id | company | contact | email):\n${list}\n\nSource:\n<source>\n${text}\n</source>` }],
    output_config: { format: zodOutputFormat(LinkSchema) },
  });
  return assertParsed(res, LinkSchema);
}

// ---------- F2: extraction (Sonnet) ----------
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

export async function extract(text: string, account: string) {
  const res = await client().messages.parse({
    model: MODELS.extraction,
    max_tokens: 16000,
    system:
      `You extract AtliQ's sales commitments into a fixed schema. Today is ${TODAY}. ` +
      "Capture client asks needing AtliQ action, promises AtliQ people made, deadlines, revisit dates, referrals, cross-sell hints, budget and stakeholder facts. " +
      "Every item must carry at least one verbatim quote copied character for character from the source; an item without a quote is not allowed. " +
      "Vague dates ('mid-July', 'next week', 'Q2') become a window with approximate=true. " +
      "Mark SOWs, pricing, contract terms, proposals and security questionnaires as restricted. " +
      "Also propose CRM field updates the source supports, each with a verbatim quote. " +
      GROUNDING,
    messages: [{ role: "user", content: `Account: ${account}\n\n<source>\n${text}\n</source>` }],
    output_config: { format: zodOutputFormat(ExtractSchema) },
  });
  return assertParsed(res, ExtractSchema);
}

// ---------- F4: reply draft (Sonnet) ----------
export async function draftReply(input: { account: string; owner: string; ask: string; context: string }) {
  const res = await client().messages.create({
    model: MODELS.drafts,
    max_tokens: 4000,
    system:
      "You draft a short, warm reply email for an AtliQ seller to review, edit and send themselves. You never send anything. " +
      "Use only the account context provided; it contains this one client's records and nothing else. " +
      "Answer the open ask. Apologise briefly if AtliQ is late. Sign with the seller's first name. " +
      GROUNDING,
    messages: [
      {
        role: "user",
        content: `Seller: ${input.owner}\nAccount: ${input.account}\nOpen item: ${input.ask}\n\nAccount context:\n<context>\n${input.context}\n</context>\n\nWrite only the email body.`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

// ---------- F3: brief one-liners (Haiku) ----------
const SummarySchema = z.object({ lines: z.array(z.object({ id: z.string(), line: z.string() })) });

export async function briefLines(items: { id: string; facts: string }[]) {
  const res = await client().messages.parse({
    model: MODELS.brief,
    max_tokens: 2048,
    system:
      "Write one plain-English line per item for a seller's morning brief, under 25 words, starting with the action. " +
      "Restate only the facts given. Do not add dates, amounts or names that are not in the facts.",
    messages: [{ role: "user", content: items.map((i) => `${i.id}: ${i.facts}`).join("\n") }],
    output_config: { format: zodOutputFormat(SummarySchema) },
  });
  return assertParsed(res, SummarySchema);
}

function assertParsed<S extends z.ZodType>(res: { parsed_output?: unknown; stop_reason: string | null }, schema: S): z.infer<S> {
  if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
  const parsed = schema.safeParse(res.parsed_output);
  if (!parsed.success) throw new Error("The model's output did not match the schema.");
  return parsed.data;
}

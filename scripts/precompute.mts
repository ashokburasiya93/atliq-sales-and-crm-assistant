// Re-runs F1 linking triage (Haiku 4.5) and F2 extraction (Sonnet 5.5) over every dataset
// source with the live Claude API, and writes the results to data/precomputed/live-run/
// for review. Quotes the model returns are checked against the source; failures are dropped.
// Usage: ANTHROPIC_API_KEY=... npm run precompute
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extract, linkSource, liveEnabled, MODELS } from "../src/lib/llm";
import { memory } from "../src/lib/memory";
import { norm } from "../src/lib/preprocess";

if (!liveEnabled()) {
  console.error("Set ANTHROPIC_API_KEY in your environment to run the live pipeline.");
  process.exit(1);
}

const m = memory();
const outDir = join(process.cwd(), "data", "precomputed", "live-run");
mkdirSync(outDir, { recursive: true });
const accounts = m.accounts.filter((a) => !a.isDraft).map((a) => ({ id: a.id, company: a.company, contact: a.contact, email: a.email }));

const items: Record<string, unknown>[] = [];
const links: unknown[] = [];
let droppedQuotes = 0;
for (const s of m.sources) {
  const det = m.links.find((l) => l.sourceId === s.id)!;
  // Rules first; the model only resolves what the rules could not place confidently.
  const link = det.state === "confident" || det.state === "internal" ? null : await linkSource(s.text, accounts);
  links.push({ source: s.id, deterministic: det.state, primary: det.primary, model: link });
  if (link && !link.hasCommitment) continue;

  const account = link?.accountId || det.primary || "internal";
  const out = await extract(s.text, account);
  const text = norm(s.text);
  out.items.forEach((it, n) => {
    const quotes = it.quotes.filter((q) => text.includes(norm(q)));
    droppedQuotes += it.quotes.length - quotes.length;
    if (!quotes.length) return; // no quote, no item
    items.push({
      id: `${s.id}#${n + 1}`,
      account,
      type: it.type,
      summary: it.summary,
      owedBy: it.owedBy,
      owedTo: it.owedTo,
      arose: it.arose,
      due: it.dueStart ? { text: it.dueText, start: it.dueStart, end: it.dueEnd || it.dueStart, approximate: it.approximate } : null,
      quotes: quotes.map((q) => ({ source: s.id, text: q })),
      status: ["budget", "stakeholder"].includes(it.type) ? "signal" : "open",
      restricted: it.restricted || null,
      confidence: it.confidence,
    });
  });
  console.log(`${s.id}: ${out.items.length} items, ${out.crmUpdates.length} CRM updates`);
}

writeFileSync(join(outDir, "links.json"), JSON.stringify({ model: MODELS.capture, links }, null, 1));
writeFileSync(join(outDir, "extractions.json"), JSON.stringify({ _meta: { model: MODELS.extraction }, items }, null, 1));
console.log(`\nWrote ${items.length} items to ${outDir}. ${droppedQuotes} quote(s) failed verification and were dropped.`);
console.log("Review them, then reconcile into data/precomputed/extractions.json (cross-source merges and completions).");

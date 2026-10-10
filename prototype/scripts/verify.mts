// Build-time guardrail check. Fails the build if any shown item lacks a verified quote,
// if a draft leaks another client's names or an unsupported amount, or if a draft answers
// a restricted ask. Prints the eval scorecard.
import { memory } from "../src/lib/memory";

const m = memory();
let failed = false;

for (const e of m.evals) {
  console.log(`${e.pass ? "PASS" : "FAIL"}  ${e.name}: ${e.value}`);
  if (!e.pass) for (const d of e.detail.filter((x) => !x.ok)) console.log(`        - ${d.label}: ${d.note ?? ""}`);
}

const hard = ["Citation faithfulness", "Draft safety"];
for (const e of m.evals) if (hard.includes(e.name) && !e.pass) failed = true;
if (m.dropped.length) {
  console.log(`\n${m.dropped.length} item(s) dropped by the grounding check:`);
  for (const d of m.dropped) console.log(`  - ${d.id}: ${d.reason}`);
}

console.log(`\nLedger: ${m.items.length} items, ${m.proposals.length} proposals, ${m.drafts.length} drafts, ${m.sources.length} sources.`);
if (failed) {
  console.error("verify: a hard guardrail failed. Fix the data before deploying.");
  process.exit(1);
}

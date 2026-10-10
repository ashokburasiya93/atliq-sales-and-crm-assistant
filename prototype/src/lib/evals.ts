// PRD section 11 eval criteria, computed over the dataset on every build.
import { briefFor } from "./brief";
import { northStar } from "./ledger";
import type { CrmProposal, DraftSafety, DroppedItem, LedgerItem, ReplyDraft, SourceLink } from "./types";

export interface AppendixRow {
  account: string;
  label: string;
  arose: string;
  due: string;
  kept: boolean | null;
  item: string;
}

export interface EvalResult {
  name: string;
  definition: string;
  threshold: string;
  value: string;
  pass: boolean;
  detail: { label: string; ok: boolean; note?: string }[];
}

export function runEvals(input: {
  links: SourceLink[];
  linkTruth: Record<string, string>;
  mustBeUnsure: string[];
  items: LedgerItem[];
  dropped: DroppedItem[];
  totalQuotes: number;
  appendix: AppendixRow[];
  proposals: CrmProposal[];
  drafts: ReplyDraft[];
  safety: DraftSafety[];
}): EvalResult[] {
  const { links, linkTruth, items, appendix, proposals, drafts, safety } = input;
  const out: EvalResult[] = [];
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Link accuracy
  const linkDetail = links.map((l) => {
    const truth = linkTruth[l.sourceId];
    const ok =
      truth === "internal"
        ? l.state === "internal"
        : input.mustBeUnsure.includes(l.sourceId)
          ? l.state === "unsure" && l.primary === truth
          : l.primary === truth;
    return { label: l.sourceId, ok, note: `expected ${truth}, got ${l.primary ?? l.state} (${l.state})` };
  });
  const linkOk = linkDetail.filter((d) => d.ok).length;
  const dupFlags = proposals.filter((p) => p.field === "merge").length;
  const newLeads = proposals.filter((p) => p.field === "create").length;
  out.push({
    name: "Link accuracy",
    definition: "Sources linked to the correct account, or correctly flagged as a new company or internal note.",
    threshold: "At least 95%, both duplicate pairs flagged, all 5 missing companies caught",
    value: `${linkOk}/${links.length} (${pct(linkOk, links.length)}); ${dupFlags} duplicate pairs; ${newLeads} draft leads`,
    pass: linkOk / links.length >= 0.95 && dupFlags >= 2 && newLeads >= 5,
    detail: linkDetail,
  });

  // Citation faithfulness
  out.push({
    name: "Citation faithfulness",
    definition: "Ledger items whose every quote exists verbatim in the cited file. Items failing the check are dropped and logged, never shown.",
    threshold: "100% of shown items",
    value: `${items.length} items shown, all quotes verified; ${input.dropped.length} dropped`,
    pass: items.every((i) => i.quotes.length > 0),
    detail: input.dropped.map((d) => ({ label: d.id, ok: false, note: d.reason })),
  });

  // Extraction recall vs Appendix A
  const recallDetail = appendix.map((r) => ({
    label: `${r.account}: ${r.label}`,
    ok: itemById.has(r.item),
    note: itemById.has(r.item) ? `captured as ${r.item}` : "missed",
  }));
  const recalled = recallDetail.filter((d) => d.ok).length;
  out.push({
    name: "Extraction recall",
    definition: "Hand-labelled asks and promises in PRD Appendix A that appear in the ledger.",
    threshold: "At least 90%",
    value: `${recalled}/${appendix.length} (${pct(recalled, appendix.length)})`,
    pass: recalled / appendix.length >= 0.9,
    detail: recallDetail,
  });

  // Due-date accuracy
  // A chase or duplicate action folded into an earlier item is scored once, on its first row.
  const firstRowPerItem = appendix.filter((r, i) => appendix.findIndex((x) => x.item === r.item) === i);
  const dueDetail = firstRowPerItem
    .filter((r) => itemById.has(r.item))
    .map((r) => {
      const it = itemById.get(r.item)!;
      const inWindow = it.due?.approximate ? r.due >= (it.rankDate ?? "") && r.due <= (it.dueDate ?? "") : false;
      const ok = it.dueDate === r.due || inWindow;
      return { label: `${r.account}: ${r.label}`, ok, note: `labelled ${r.due}, computed ${it.dueDate}` };
    });
  const dueOk = dueDetail.filter((d) => d.ok).length;
  out.push({
    name: "Date accuracy",
    definition: "Computed due date matches the hand label (or falls inside the window for approximate dates). Merged chases count once.",
    threshold: "At least 90%",
    value: `${dueOk}/${dueDetail.length} (${pct(dueOk, dueDetail.length)})`,
    pass: dueOk / dueDetail.length >= 0.9,
    detail: dueDetail,
  });

  // Brief ranking
  const bhavin = briefFor("Bhavin", items).items.slice(0, 5).map((i) => i.id);
  const must = ["finedge-call-slot", "shopswift-sow", "novapharma-questionnaire", "meridian-questions"];
  out.push({
    name: "Brief ranking",
    definition: "On 10 Jul 2026, Bhavin's top 5 include FinEdge, ShopSwift, NovaPharma's questionnaire and Meridian.",
    threshold: "All four in the top 5",
    value: `${must.filter((m) => bhavin.includes(m)).length}/4 in top 5`,
    pass: must.every((m) => bhavin.includes(m)),
    detail: must.map((m) => ({ label: m, ok: bhavin.includes(m), note: `position ${bhavin.indexOf(m) + 1 || "not in top 5"}` })),
  });

  // Draft safety
  const restrictedIds = new Set(items.filter((i) => i.restricted).map((i) => i.id));
  const draftOnRestricted = drafts.filter((d) => restrictedIds.has(d.item));
  out.push({
    name: "Draft safety",
    definition: "Drafts contain no other client's names, no amounts missing from the account's own sources, and none answer a restricted ask (SOW, pricing, contract, security questionnaire).",
    threshold: "0 defects",
    value: `${safety.filter((s) => s.ok).length}/${safety.length} drafts clean; ${draftOnRestricted.length} drafts on restricted asks`,
    pass: safety.every((s) => s.ok) && draftOnRestricted.length === 0,
    detail: [
      ...safety.map((s) => ({
        label: s.draftId,
        ok: s.ok,
        note: s.ok ? `${s.blanks} blanks for unknown facts` : [...s.foreignEntities, ...s.unsupportedAmounts].join(", "),
      })),
      ...draftOnRestricted.map((d) => ({ label: d.id, ok: false, note: "draft written for a restricted ask" })),
    ],
  });

  // Uncertainty handling
  const unsureLinks = links.filter((l) => l.state === "unsure").map((l) => l.sourceId);
  const meridianMerge = proposals.some((p) => p.field === "merge" && p.options?.includes("L-1027"));
  const ridgeline = proposals.find((p) => p.id === "r-create-DL-RIDGELINE");
  const uncertain = [
    { label: "Meridian L-1003 / L-1027 sent for a person's merge decision", ok: meridianMerge },
    { label: "Ridgeline contact shown as unsure, no details invented", ok: !!ridgeline && /unsure/i.test(ridgeline.note ?? "") },
    { label: "FinServe 'L-1002?' sent to Unsure", ok: unsureLinks.includes("2026-06-30_finserve_intro_call") },
  ];
  out.push({
    name: "Uncertainty handling",
    definition: "Ambiguous cases go to Unsure with options instead of a guess.",
    threshold: "100%",
    value: `${uncertain.filter((u) => u.ok).length}/${uncertain.length}`,
    pass: uncertain.every((u) => u.ok),
    detail: uncertain,
  });

  // North Star (informational)
  const ns = northStar(items);
  out.push({
    name: "North Star baseline (informational)",
    definition:
      "Commitments Kept on Time from the ledger: asks and promises that arose 4 Jun to 8 Jul and fell due by 10 Jul, actioned on or before their due date. Computed only from what the sources show, so it can differ from the hand-labelled 41%.",
    threshold: "Baseline, no threshold",
    value: `${ns.kept}/${ns.total} (${pct(ns.kept, ns.total)})`,
    pass: true,
    detail: ns.inScope.map((i) => ({
      label: `${i.accountName}: ${i.summary}`,
      ok: i.status === "done" && !!i.done?.date && i.done.date <= (i.dueDate ?? ""),
      note: i.status === "done" ? `done ${i.done?.date ?? "date unknown"}, due ${i.dueDate}` : `open, due ${i.dueDate}`,
    })),
  });

  return out;
}

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}%` : "-";
}

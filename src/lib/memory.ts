// Assembles the whole Sales Memory from the dataset and the precomputed model outputs.
// Pure and deterministic: the same inputs always give the same ledger, briefs and evals.
import sourcesJson from "@/generated/sources.json";
import crmJson from "@/generated/crm.json";
import crmRawJson from "@/generated/crm_raw.json";
import unreadableJson from "@/generated/unreadable.json";
import extractions from "../../data/precomputed/extractions.json";
import capture from "../../data/precomputed/capture.json";
import crmProposals from "../../data/precomputed/crm_proposals.json";
import draftsJson from "../../data/precomputed/drafts.json";
import linkTruth from "../../data/eval/link_truth.json";
import appendixA from "../../data/eval/appendix_a.json";

import { briefFor } from "./brief";
import { runEvals, type AppendixRow } from "./evals";
import { buildLedger, sourceTextIndex } from "./ledger";
import { linkSources, type Resolution } from "./link";
import { accountsFrom, buildProposals, type RawProposal } from "./proposals";
import { checkDraft } from "./safety";
import { SELLERS } from "./team";
import type { CrmRecord, DraftLead, RawItem, ReplyDraft, Source } from "./types";

function build() {
  const sources = sourcesJson as unknown as Source[];
  const crm = crmJson as unknown as CrmRecord[];
  const crmRaw = (crmRawJson as { text: string }).text;
  const leads = capture.leads as unknown as DraftLead[];
  const accounts = accountsFrom(crm, leads);
  const links = linkSources(sources, crm, accounts, capture.resolutions as unknown as Resolution[]);
  const idx = sourceTextIndex(sources, crmRaw);

  const rawProposals = crmProposals.proposals as unknown as RawProposal[];
  const proposedOwners = new Map(rawProposals.filter((p) => p.field === "owner").map((p) => [p.account, p.proposed]));
  const rawItems = extractions.items as unknown as RawItem[];
  const { items, dropped } = buildLedger(rawItems, sources, crmRaw, accounts, links, proposedOwners);
  const { proposals, dropped: droppedProposals } = buildProposals(rawProposals, crm, leads, items, idx);

  const drafts = (draftsJson.drafts as unknown as ReplyDraft[]).map((d) => ({ ...d, model: draftsJson._meta.model }));
  const safety = drafts.map((d) => checkDraft(d, accounts, sources));
  const briefs = Object.fromEntries(SELLERS.map((s) => [s, briefFor(s, items)]));

  const evals = runEvals({
    links,
    linkTruth: linkTruth.truth as Record<string, string>,
    mustBeUnsure: linkTruth.mustBeUnsure,
    items,
    dropped,
    totalQuotes: rawItems.length,
    appendix: appendixA.rows as unknown as AppendixRow[],
    proposals,
    drafts,
    safety,
  });

  return {
    sources,
    crm,
    accounts,
    links,
    items,
    dropped: [...dropped, ...droppedProposals],
    proposals,
    drafts,
    safety,
    briefs,
    evals,
    unreadable: unreadableJson as { file: string; reason: string }[],
    models: {
      capture: capture._meta.model,
      extraction: extractions._meta.model,
      drafts: draftsJson._meta.model,
      brief: "claude-haiku-4-5-20251001",
    },
  };
}

let cached: ReturnType<typeof build> | null = null;
export function memory() {
  if (!cached) cached = build();
  return cached;
}

export type Memory = ReturnType<typeof build>;

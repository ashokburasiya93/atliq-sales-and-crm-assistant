// F4 proposals: the model's field proposals plus rule-based ones (next follow-up dates,
// duplicate merges, draft leads). Every proposal carries evidence and waits for approval.
import { TODAY } from "./dates";
import { duplicateGroups } from "./link";
import { ACTIONABLE, quoteFound } from "./ledger";
import type { Account, CrmProposal, CrmRecord, DraftLead, LedgerItem, Quote } from "./types";

export interface RawProposal {
  id: string;
  account: string;
  field: CrmProposal["field"];
  proposed: string;
  options?: string[];
  confidence: number;
  note?: string;
  evidence: Quote[];
}

export function buildProposals(
  raw: RawProposal[],
  crm: CrmRecord[],
  leads: DraftLead[],
  items: LedgerItem[],
  sourceIdx: Map<string, string>,
): { proposals: CrmProposal[]; dropped: { id: string; reason: string }[] } {
  const byId = new Map(crm.map((c) => [c.lead_id, c]));
  const proposals: CrmProposal[] = [];
  const dropped: { id: string; reason: string }[] = [];

  for (const p of raw) {
    const rec = byId.get(p.account);
    const bad = p.evidence.find((q) => !quoteFound(q, sourceIdx));
    if (!rec || bad || !p.evidence.length) {
      dropped.push({ id: p.id, reason: !rec ? `Unknown account ${p.account}` : "Evidence quote not found in source" });
      continue;
    }
    const current = String((rec as unknown as Record<string, unknown>)[p.field] ?? "");
    if (current === p.proposed && !p.options) continue;
    proposals.push({ ...p, current, origin: "model" });
  }

  // Rule: every open deal gets a next follow-up date (0 of 40 have one today).
  for (const rec of crm) {
    const open = items
      .filter((i) => i.account === rec.lead_id && i.status === "open" && ACTIONABLE.has(i.type) && i.dueDate)
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
    if (!open.length || rec.next_followup_date) continue;
    const first = open[0];
    const date = first.dueDate! < TODAY ? TODAY : first.dueDate!;
    proposals.push({
      id: `r-followup-${rec.lead_id}`,
      account: rec.lead_id,
      field: "next_followup_date",
      current: rec.next_followup_date,
      proposed: date,
      evidence: [first.quotes[0]],
      confidence: 0.95,
      origin: "rule",
      note: `Earliest open item: ${first.summary}${first.overdue ? " (overdue, so today)" : ""}`,
    });
  }

  // Rule: duplicate records are flagged for a merge decision, never merged automatically.
  for (const g of duplicateGroups(crm)) {
    const recs = g.map((id) => byId.get(id)!);
    const evidence: Quote[] = recs.map((r) => ({
      source: "crm_export",
      text: `${r.lead_id},${r.company},${r.contact_name},${r.contact_email}`,
    }));
    if (recs.some((r) => /meridian/i.test(r.company)))
      evidence.push({ source: "2026-06-14_techsummit_debrief", text: "Now sitting in CRM twice: L-1003 and L-1027." });
    proposals.push({
      id: `r-merge-${g.join("-")}`,
      account: g[0],
      field: "merge",
      current: recs.map((r) => `${r.lead_id} ${r.company} (${r.owner || "no owner"}, ${r.status || "no status"})`).join(" + "),
      proposed: `Keep ${g[0]} as the record; fold ${g.slice(1).join(", ")} into it`,
      options: g,
      evidence: evidence.filter((q) => quoteFound(q, sourceIdx)),
      confidence: 0.9,
      origin: "rule",
      note: "Same company entered twice. Unsure which record and owner to keep, so a person decides.",
    });
  }

  // Draft leads become "create record" proposals.
  for (const l of leads) {
    proposals.push({
      id: `r-create-${l.id}`,
      account: l.id,
      field: "create",
      current: "Not in CRM",
      proposed: `${l.company} | ${l.contact}${l.email ? ` <${l.email}>` : ""} | ${l.source}${l.referrer ? ` via ${l.referrer}` : ""} | ${l.serviceInterest} | owner: ${l.proposedOwner || "Unassigned"}`,
      evidence: l.evidence,
      confidence: l.contactUncertain ? 0.6 : 0.9,
      origin: "model",
      note: l.contactUncertain ? `Contact name unsure: ${l.contactUncertain.join(" or ")}. No contact details invented.` : undefined,
    });
  }
  return { proposals, dropped };
}

export function accountsFrom(crm: CrmRecord[], leads: DraftLead[]): Account[] {
  return [
    ...crm.map((c) => ({
      id: c.lead_id,
      company: c.company,
      contact: c.contact_name,
      email: c.contact_email,
      owner: c.owner,
      status: c.status,
      value: c.est_value_usd,
      isDraft: false,
      crm: c,
    })),
    ...leads.map((l) => ({
      id: l.id,
      company: l.company,
      contact: l.contact,
      email: l.email,
      owner: l.proposedOwner,
      status: "Draft lead",
      value: null,
      isDraft: true,
      draft: l,
    })),
  ];
}

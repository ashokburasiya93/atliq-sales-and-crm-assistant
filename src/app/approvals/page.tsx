import Link from "next/link";
import { ExportChanges } from "@/components/ExportChanges";
import { ProposalRow } from "@/components/ProposalRow";
import { memory } from "@/lib/memory";

export default function ApprovalsPage() {
  const m = memory();
  const name = (id: string) => m.accounts.find((a) => a.id === id)?.company ?? id;
  const unsureLinks = m.links.filter((l) => l.state === "unsure");
  const unsureProposals = m.proposals.filter((p) => p.field === "merge" || (p.options && !p.proposed));
  const leads = m.proposals.filter((p) => p.field === "create");
  const updates = m.proposals.filter((p) => !unsureProposals.includes(p) && p.field !== "create");
  const modelUpdates = updates.filter((p) => p.origin === "model");
  const ruleUpdates = updates.filter((p) => p.origin === "rule");

  return (
    <>
      <div className="page-head">
        <h1>Approvals</h1>
        <p className="sub">
          Propose, never act alone. Nothing here changes the CRM until a named seller approves it, and every decision is logged with who and when.
          Approved changes are exported as a change file for the CRM (the PRD&apos;s fallback until CRM API write-back exists).
        </p>
        <ExportChanges proposals={m.proposals.map((p) => ({ id: p.id, account: p.account, company: name(p.account), field: p.field, current: p.current }))} />
      </div>

      <h2>Unsure: a person decides ({unsureLinks.length + unsureProposals.length})</h2>
      {unsureLinks.map((l) => (
        <div className="card" key={l.sourceId}>
          <div className="card-top">
            <span className="summary">
              Which account is <Link href={`/sources/${l.sourceId}`}>{m.sources.find((s) => s.id === l.sourceId)?.title}</Link>?
            </span>
            <span className="chip amber">unsure</span>
          </div>
          <p className="sub">{l.reason}</p>
          <div className="meta">
            {l.edges.map((e) => (
              <span key={e.accountId}>
                <Link href={`/accounts/${e.accountId}`}>{name(e.accountId)}</Link> ({e.method}, {Math.round(e.confidence * 100)}%)
              </span>
            ))}
            <span>or a new lead</span>
          </div>
        </div>
      ))}
      {unsureProposals.map((p) => (
        <ProposalRow key={p.id} p={p} accountName={name(p.account)} />
      ))}

      <h2>New leads found in emails and notes ({leads.length})</h2>
      {leads.map((p) => (
        <ProposalRow key={p.id} p={p} accountName={name(p.account)} />
      ))}

      <h2>CRM field updates from conversations ({modelUpdates.length})</h2>
      {modelUpdates.map((p) => (
        <ProposalRow key={p.id} p={p} accountName={name(p.account)} />
      ))}

      <h2>Next follow-up dates ({ruleUpdates.length})</h2>
      <p className="sub">0 of 40 CRM records have a next follow-up date. These come from the earliest open item on each account.</p>
      {ruleUpdates.map((p) => (
        <ProposalRow key={p.id} p={p} accountName={name(p.account)} />
      ))}
    </>
  );
}

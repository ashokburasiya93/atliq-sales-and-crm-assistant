import Link from "next/link";
import { notFound } from "next/navigation";
import { Quotes } from "@/components/bits";
import { ItemCard } from "@/components/ItemCard";
import { ProposalRow } from "@/components/ProposalRow";
import { fmt, money } from "@/lib/dates";
import { memory } from "@/lib/memory";

export function generateStaticParams() {
  return memory().accounts.map((a) => ({ id: a.id }));
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = memory();
  const a = m.accounts.find((x) => x.id === id);
  if (!a) notFound();
  const links = m.links.filter((l) => l.edges.some((e) => e.accountId === id));
  const items = m.items.filter((i) => i.account === id);
  const proposals = m.proposals.filter((p) => p.account === id || p.options?.includes(id));
  const drafts = m.drafts.filter((d) => d.account === id);
  const draftByItem = new Map(drafts.map((d) => [d.item, d]));

  return (
    <>
      <div className="page-head">
        <h1>{a.company}</h1>
        <p className="sub">
          {a.id} · {a.isDraft ? "Draft lead, not in the CRM yet" : `CRM status: ${a.status || "blank"}`} · Owner: {a.owner || "none"} · Value:{" "}
          {money(a.value)}
        </p>
      </div>

      {a.crm && (
        <div className="panel">
          <h3>CRM record as exported</h3>
          <div className="meta">
            <span>Contact: {a.crm.contact_name || "-"} {a.crm.contact_email && `<${a.crm.contact_email}>`}</span>
            <span>Source: {a.crm.source}</span>
            <span>Service: {a.crm.service_interest || "-"}</span>
            <span>Created {fmt(a.crm.created_date)}</span>
            <span>Last contact {fmt(a.crm.last_contact_date)}</span>
            <span>Next follow-up {fmt(a.crm.next_followup_date)}</span>
          </div>
          <p className="sub">Notes: {a.crm.notes || "-"}</p>
        </div>
      )}
      {a.draft && (
        <div className="panel">
          <h3>Draft lead</h3>
          <div className="meta">
            <span>Contact: {a.draft.contact}{a.draft.email && ` <${a.draft.email}>`}</span>
            <span>Source: {a.draft.source}</span>
            {a.draft.referrer && <span>Referrer: {a.draft.referrer}</span>}
            <span>Interest: {a.draft.serviceInterest}</span>
            <span>Proposed owner: {a.draft.proposedOwner || "Unassigned"}</span>
          </div>
          <Quotes quotes={a.draft.evidence} />
        </div>
      )}

      <h2>Ledger ({items.length})</h2>
      {items.length === 0 && <p className="sub">No asks, promises or signals found for this account.</p>}
      {items.map((i) => (
        <ItemCard key={i.id} item={i} draft={draftByItem.get(i.id)} />
      ))}

      <h2>Proposed CRM changes ({proposals.length})</h2>
      {proposals.length === 0 && <p className="sub">Nothing to propose.</p>}
      {proposals.map((p) => (
        <ProposalRow key={p.id} p={p} accountName={a.company} />
      ))}

      <h2>Linked sources ({links.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Link</th>
              <th>Method</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => {
              const e = l.edges.find((x) => x.accountId === id)!;
              return (
                <tr key={l.sourceId}>
                  <td>
                    <Link href={`/sources/${l.sourceId}`}>{m.sources.find((s) => s.id === l.sourceId)?.title}</Link>
                    <div className="sub">{l.sourceId}</div>
                  </td>
                  <td>
                    {e.role}
                    {l.state === "unsure" && <span className="chip amber" style={{ marginLeft: 6 }}>unsure</span>}
                  </td>
                  <td className="sub">{e.method}</td>
                  <td>{Math.round(e.confidence * 100)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

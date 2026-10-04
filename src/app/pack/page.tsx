import Link from "next/link";
import { Quotes } from "@/components/bits";
import { tierOf } from "@/lib/brief";
import { daysBetween, fmt, money, TODAY } from "@/lib/dates";
import { northStar } from "@/lib/ledger";
import { memory } from "@/lib/memory";
import { SELLERS } from "@/lib/team";

export default function PackPage() {
  const m = memory();
  const open = m.items.filter((i) => i.status === "open" && i.type !== "budget" && i.type !== "stakeholder");
  const overdue = open.filter((i) => i.overdue);
  const unassigned = open.filter((i) => i.owner === "Unassigned" || (i.routedTo && !i.routeAccepted));
  const atRisk = open.filter((i) => tierOf(i) === 1);
  const atRiskAccounts = new Map(atRisk.map((i) => [i.account, i]));
  const atRiskValue = [...atRiskAccounts.values()].reduce((s, i) => s + (i.openValue ?? 0), 0);
  const ns = northStar(m.items);
  const opportunities = m.items.filter((i) => i.opportunity);
  const merges = m.proposals.filter((p) => p.field === "merge");
  const leads = m.accounts.filter((a) => a.isDraft);
  const crm = m.crm;
  const quiet = crm.filter(
    (c) => !["Won", "Lost"].includes(c.status) && c.last_contact_date && daysBetween(c.last_contact_date, TODAY) > 60,
  );
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };

  return (
    <>
      <div className="page-head">
        <h1>Pipeline review pack</h1>
        <p className="sub">Ready-made for the founders&apos; review, as of 10 Jul 2026. Replaces the ~2 hours Jay spends reconciling the CRM against inboxes.</p>
      </div>

      <div className="grid cols-4">
        <div className="panel stat">
          <div className="n">{Math.round(ns.rate * 100)}%</div>
          <div className="l">
            North Star: commitments kept on time ({ns.kept}/{ns.total}, 4 Jun to 8 Jul). Target 80%.
          </div>
        </div>
        <div className="panel stat">
          <div className="n">{overdue.length}</div>
          <div className="l">open items past due, median {median(overdue.map((i) => daysBetween(i.dueDate!, TODAY)))} days late</div>
        </div>
        <div className="panel stat">
          <div className="n">{money(atRiskValue)}</div>
          <div className="l">valued pipeline across {atRiskAccounts.size} deals behind an overdue or at-risk AtliQ action</div>
        </div>
        <div className="panel stat">
          <div className="n">
            {crm.filter((c) => c.next_followup_date).length}/{crm.length}
          </div>
          <div className="l">CRM records with a next follow-up date ({m.proposals.filter((p) => p.field === "next_followup_date").length} proposed)</div>
        </div>
      </div>

      <h2>Overdue by owner</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Owner</th>
              <th>Overdue items</th>
            </tr>
          </thead>
          <tbody>
            {[...SELLERS, "Unassigned"].map((s) => {
              const mine = overdue.filter((i) => i.owner === s).sort((a, b) => b.daysWaiting - a.daysWaiting);
              return (
                <tr key={s}>
                  <td>
                    {SELLERS.includes(s as (typeof SELLERS)[number]) ? <Link href={`/brief/${s.toLowerCase()}`}>{s}</Link> : s} ({mine.length})
                  </td>
                  <td>
                    {mine.map((i) => (
                      <div key={i.id}>
                        <Link href={`/accounts/${i.account}`}>{i.accountName}</Link>: {i.summary}{" "}
                        <span className="sub">(due {fmt(i.dueDate)})</span>
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Unowned work ({unassigned.length})</h2>
      {unassigned.map((i) => (
        <div className="card" key={i.id}>
          <strong>{i.accountName}</strong>: {i.summary}
          <div className="sub">
            {i.owner === "Unassigned" ? `No owner. Proposed: ${i.proposedOwner ?? "none"}` : `Routed to ${i.routedTo}, not accepted`} · due {fmt(i.dueDate)}
          </div>
          <Quotes quotes={i.quotes} limit={1} />
        </div>
      ))}

      <h2>Revived, referral and cross-sell opportunities ({opportunities.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>Owner</th>
              <th>State</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link href={`/accounts/${i.account}`}>{i.opportunity}</Link>
                </td>
                <td>{i.owner}</td>
                <td>{i.status === "done" ? "replied" : i.overdue ? <span className="chip red">overdue</span> : "open"}</td>
                <td>
                  <Quotes quotes={i.quotes} limit={1} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Missing leads ({leads.length})</h2>
      <p className="sub">Companies in emails and notes that are not in the CRM. Drafted for approval, never written directly.</p>
      <ul>
        {leads.map((a) => (
          <li key={a.id}>
            <Link href={`/accounts/${a.id}`}>{a.company}</Link>: {a.draft?.serviceInterest}
            {a.draft?.referrer ? `, referred by ${a.draft.referrer}` : ""}
          </li>
        ))}
      </ul>

      <h2>Duplicate records ({merges.length})</h2>
      {merges.map((p) => (
        <div className="card" key={p.id}>
          {p.current}
          <Quotes quotes={p.evidence} />
        </div>
      ))}

      <h2>CRM gaps</h2>
      <ul>
        <li>{crm.filter((c) => c.est_value_usd == null).length} of {crm.length} records have no value</li>
        <li>{crm.filter((c) => !c.owner).length} have no owner: {crm.filter((c) => !c.owner).map((c) => c.company).join(", ")}</li>
        <li>{crm.filter((c) => !c.status).length} have no status</li>
        <li>{crm.filter((c) => !c.next_followup_date).length} have no next follow-up date</li>
        <li>
          {quiet.length} open records with no CRM contact for over 60 days:{" "}
          {quiet.map((c, n) => (
            <span key={c.lead_id}>
              {n ? ", " : ""}
              <Link href={`/accounts/${c.lead_id}`}>{c.company}</Link>
            </span>
          ))}
        </li>
      </ul>
    </>
  );
}

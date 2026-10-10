import Link from "next/link";
import { fmt, money } from "@/lib/dates";
import { memory } from "@/lib/memory";

export default function AccountsPage() {
  const m = memory();
  const mergeIds = new Set(m.proposals.filter((p) => p.field === "merge").flatMap((p) => p.options ?? []));
  const rows = m.accounts.map((a) => {
    const sources = m.links.filter((l) => l.edges.some((e) => e.accountId === a.id && (e.role === "primary" || e.role === "candidate")));
    const open = m.items.filter((i) => i.account === a.id && i.status === "open");
    const gaps = a.isDraft
      ? ["not in CRM"]
      : [
          !a.owner && "no owner",
          a.value == null && "no value",
          !a.status && "no status",
          !a.email && "no email",
          !a.crm?.next_followup_date && open.length > 0 && "no follow-up date",
        ].filter(Boolean);
    return { a, sources, open, overdue: open.filter((i) => i.overdue).length, gaps };
  });

  return (
    <>
      <div className="page-head">
        <h1>Accounts</h1>
        <p className="sub">
          {m.crm.length} CRM records plus {m.accounts.filter((a) => a.isDraft).length} draft leads found in emails and notes. Sorted by open
          overdue items.
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Owner</th>
              <th>CRM status</th>
              <th>Value</th>
              <th>Last contact (CRM)</th>
              <th>Sources</th>
              <th>Open / overdue</th>
              <th>CRM gaps</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .sort((x, y) => y.overdue - x.overdue || y.open.length - x.open.length)
              .map(({ a, sources, open, overdue, gaps }) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/accounts/${a.id}`}>{a.company}</Link>
                    <div className="sub">
                      {a.id}
                      {mergeIds.has(a.id) && <span className="chip amber" style={{ marginLeft: 6 }}>possible duplicate</span>}
                      {a.isDraft && <span className="chip amber" style={{ marginLeft: 6 }}>draft lead</span>}
                    </div>
                  </td>
                  <td>{a.owner || <span className="chip red">none</span>}</td>
                  <td>{a.status || "-"}</td>
                  <td>{money(a.value)}</td>
                  <td>{fmt(a.crm?.last_contact_date)}</td>
                  <td>{sources.length}</td>
                  <td>
                    {open.length} / {overdue ? <span className="chip red">{overdue}</span> : 0}
                  </td>
                  <td className="sub">{gaps.join(", ") || "-"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

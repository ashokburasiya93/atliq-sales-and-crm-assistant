import Link from "next/link";
import { fmt } from "@/lib/dates";
import { memory } from "@/lib/memory";

const STATE_CHIP: Record<string, string> = { confident: "green", unsure: "amber", new: "violet", internal: "grey", unlinked: "red" };

export default function SourcesPage() {
  const m = memory();
  const name = (id: string | null) => (id ? m.accounts.find((a) => a.id === id)?.company ?? id : "-");
  const unlinked = m.links.filter((l) => l.state === "unlinked");
  const counts = m.links.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.state]: (acc[l.state] ?? 0) + 1 }), {});

  return (
    <>
      <div className="page-head">
        <h1>Sources and linking</h1>
        <p className="sub">
          {m.sources.length} sources ingested; editorial notes stripped before anything else sees them. Linking by contact email, email domain,
          lead_id and company name, with {m.models.capture} resolving what rules cannot.{" "}
          {Object.entries(counts)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")}
          .
        </p>
      </div>
      <h2>Unlinked inbox ({unlinked.length + m.unreadable.length})</h2>
      {unlinked.length + m.unreadable.length === 0 ? (
        <p className="sub">Empty. Every file was read and placed. Unreadable or unmatched files would land here, never dropped.</p>
      ) : (
        <ul>
          {m.unreadable.map((u) => (
            <li key={u.file}>
              {u.file}: {u.reason}
            </li>
          ))}
          {unlinked.map((l) => (
            <li key={l.sourceId}>
              <Link href={`/sources/${l.sourceId}`}>{l.sourceId}</Link>: {l.reason}
            </li>
          ))}
        </ul>
      )}
      <h2>All sources</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Linked to</th>
              <th>State</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {[...m.links]
              .sort((a, b) => (a.sourceId < b.sourceId ? 1 : -1))
              .map((l) => {
                const s = m.sources.find((x) => x.id === l.sourceId)!;
                const n = m.items.filter((i) => i.quotes.some((q) => q.source === s.id)).length;
                return (
                  <tr key={l.sourceId}>
                    <td>{fmt(s.date)}</td>
                    <td>
                      <Link href={`/sources/${s.id}`}>{s.title}</Link>
                      <div className="sub">{s.kind === "email" ? "email thread" : "meeting note"}</div>
                    </td>
                    <td>
                      {l.primary ? <Link href={`/accounts/${l.primary}`}>{name(l.primary)}</Link> : "-"}
                      {l.edges.length > 1 && <div className="sub">also mentions {l.edges.filter((e) => e.accountId !== l.primary).map((e) => name(e.accountId)).join(", ")}</div>}
                    </td>
                    <td>
                      <span className={`chip ${STATE_CHIP[l.state]}`}>{l.state}</span>
                    </td>
                    <td>{n}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}

import Link from "next/link";
import { fmt, money } from "@/lib/dates";
import type { LedgerItem, Quote } from "@/lib/types";

export function Quotes({ quotes, limit }: { quotes: Quote[]; limit?: number }) {
  const shown = limit ? quotes.slice(0, limit) : quotes;
  return (
    <ul className="quotes">
      {shown.map((q, i) => (
        <li key={i}>
          <q>{q.text}</q>
          <Link href={q.source === "crm_export" ? "/accounts" : `/sources/${q.source}`}>
            {q.source === "crm_export" ? "crm_export.csv" : q.source}
          </Link>
        </li>
      ))}
      {limit && quotes.length > limit ? <li className="sub">+{quotes.length - limit} more quote(s)</li> : null}
    </ul>
  );
}

export function ItemChips({ item }: { item: LedgerItem }) {
  return (
    <>
      <span className="chip grey">{item.type}</span>
      {item.status === "done" && <span className="chip green">done{item.done?.date ? ` ${fmt(item.done.date)}` : ""}</span>}
      {item.overdue && <span className="chip red">overdue</span>}
      {item.status === "open" && item.dueDate === "2026-07-10" && <span className="chip amber">due today</span>}
      {item.due?.approximate && <span className="chip amber" title={`Vague date: "${item.due.text}"`}>approx. date</span>}
      {item.restricted && (
        <span className="chip violet" title="Restricted request: routed as a task, never drafted by AI">
          restricted: {item.restricted}
        </span>
      )}
      {item.routedTo && (
        <span className={`chip ${item.routeAccepted ? "blue" : "red"}`}>
          routed to {item.routedTo}
          {item.routeAccepted ? "" : ", not accepted"}
        </span>
      )}
      {item.owner === "Unassigned" && <span className="chip red">Unassigned</span>}
      {item.accountUnconfirmed && <span className="chip amber">account unconfirmed</span>}
      {item.accountName && item.account.startsWith("DL-") && <span className="chip amber">draft lead</span>}
    </>
  );
}

export function ItemMeta({ item }: { item: LedgerItem }) {
  return (
    <div className="meta">
      <span>
        <Link href={`/accounts/${item.account}`}>{item.accountName}</Link>
      </span>
      <span>Owner: {item.owner}{item.proposedOwner ? ` (proposed: ${item.proposedOwner})` : ""}</span>
      <span>Owed to: {item.owedTo}</span>
      {item.dueDate && (
        <span>
          Due {fmt(item.dueDate)}
          {item.due ? ` ("${item.due.text}")` : " (2 business days)"}
        </span>
      )}
      {item.clientDeadline && <span>Client deadline: {item.clientDeadline.text}</span>}
      {item.status !== "signal" && <span>{item.daysWaiting} days since raised</span>}
      <span>
        Deal:{" "}
        {item.openValue != null ? money(item.openValue) : item.dealValue != null ? `${money(item.dealValue)} (closed deal, not pipeline)` : "-"}
      </span>
      <span>Confidence {Math.round(item.confidence * 100)}%</span>
    </div>
  );
}

/** Renders a draft with [blank: ...] markers highlighted. */
export function DraftText({ text }: { text: string }) {
  const parts = text.split(/(\[blank:[^\]]*\])/g);
  return (
    <div className="draft">
      {parts.map((p, i) =>
        p.startsWith("[blank:") ? (
          <span key={i} className="blank">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </div>
  );
}

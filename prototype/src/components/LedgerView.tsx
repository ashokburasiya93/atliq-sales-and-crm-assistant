"use client";
import { useMemo, useState } from "react";
import type { LedgerItem, ReplyDraft } from "@/lib/types";
import { ItemCard } from "./ItemCard";

export function LedgerView({ items, drafts }: { items: LedgerItem[]; drafts: ReplyDraft[] }) {
  const [owner, setOwner] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const draftByItem = useMemo(() => new Map(drafts.map((d) => [d.item, d])), [drafts]);
  const owners = [...new Set(items.map((i) => i.owner))].sort();
  const types = [...new Set(items.map((i) => i.type))].sort();

  const shown = items
    .filter((i) => owner === "all" || i.owner === owner)
    .filter((i) => type === "all" || i.type === type)
    .filter((i) => status === "all" || (status === "overdue" ? i.overdue : i.status === status))
    .filter((i) => !q || `${i.summary} ${i.accountName} ${i.quotes.map((x) => x.text).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1);

  return (
    <>
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="open">Open</option>
          <option value="overdue">Overdue</option>
          <option value="done">Done</option>
          <option value="signal">Signals (budget, stakeholders)</option>
          <option value="all">All</option>
        </select>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
          <option value="all">All owners</option>
          {owners.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input type="text" placeholder="Search accounts, quotes..." value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="sub">{shown.length} shown</span>
      </div>
      {shown.map((i) => (
        <ItemCard key={i.id} item={i} draft={draftByItem.get(i.id)} />
      ))}
    </>
  );
}

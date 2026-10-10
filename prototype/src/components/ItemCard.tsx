"use client";
import { useState } from "react";
import { SELLERS } from "@/lib/team";
import type { LedgerItem, ReplyDraft, Seller } from "@/lib/types";
import { DraftPanel } from "./DraftPanel";
import { ItemChips, ItemMeta, Quotes } from "./bits";
import { useStore } from "./store";

export function ItemCard({
  item,
  rank,
  tier,
  draft,
}: {
  item: LedgerItem;
  rank?: number;
  tier?: number;
  draft?: ReplyDraft;
}) {
  const store = useStore();
  const [showDraft, setShowDraft] = useState(false);
  const [showQuotes, setShowQuotes] = useState(rank !== undefined && rank <= 3);
  const state = store.items[item.id];
  const assigned = store.assignments[item.id];
  const label = `${item.accountName}: ${item.summary}`;

  return (
    <div className={`card ${tier ? `tier${tier}` : ""} ${state ? "muted" : ""}`}>
      <div className="card-top">
        {rank !== undefined && <span className="rank">{rank}</span>}
        <span className="summary">{item.summary}</span>
      </div>
      <div className="row-flex" style={{ marginTop: 4 }}>
        <ItemChips item={item} />
        {state && <span className="chip green">{state.status} by {state.by}</span>}
        {assigned && <span className="chip blue">assigned to {assigned}</span>}
      </div>
      <ItemMeta item={item} />
      {showQuotes ? <Quotes quotes={item.quotes} /> : null}
      {item.status === "done" && item.done && (
        <Quotes quotes={[{ source: item.done.source, text: item.done.text }]} />
      )}
      {item.status !== "signal" && (
        <div className="actions">
          <button onClick={() => setShowQuotes((v) => !v)}>{showQuotes ? "Hide sources" : `Sources (${item.quotes.length})`}</button>
          {item.status === "open" &&
            (state ? (
              <button onClick={() => store.undoItem(item.id, label)}>Reopen</button>
            ) : (
              <>
                <button onClick={() => store.markItem(item.id, label, "done")}>Mark done</button>
                <button onClick={() => store.markItem(item.id, label, "snoozed")}>Snooze</button>
                <button onClick={() => store.markItem(item.id, label, "dismissed")}>Dismiss as wrong</button>
              </>
            ))}
          {item.owner === "Unassigned" && item.status === "open" && (
            <select
              aria-label="Assign owner"
              value={assigned ?? ""}
              onChange={(e) => e.target.value && store.assign(item.id, label, e.target.value as Seller)}
            >
              <option value="">Assign to...</option>
              {SELLERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {item.proposedOwner === s ? " (proposed)" : ""}
                </option>
              ))}
            </select>
          )}
          {item.status === "open" &&
            (item.restricted ? (
              <span className="sub" title="PRD guardrail: SOWs, pricing, contract terms and security questionnaires are routed, not drafted">
                No AI draft: {item.restricted} is prepared by a person.
              </span>
            ) : draft ? (
              <button className="primary" onClick={() => setShowDraft((v) => !v)}>
                {showDraft ? "Hide reply draft" : "Reply draft"}
              </button>
            ) : null)}
        </div>
      )}
      {showDraft && draft && <DraftPanel draft={draft} itemLabel={label} />}
    </div>
  );
}

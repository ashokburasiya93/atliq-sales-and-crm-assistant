"use client";
import { useMemo } from "react";
import { briefFor } from "@/lib/brief";
import { money } from "@/lib/dates";
import type { LedgerItem, ReplyDraft, Seller } from "@/lib/types";
import { ItemCard } from "./ItemCard";
import { useStore } from "./store";

const TIER_LABEL = { 1: "Money at risk", 2: "Overdue or due today", 3: "Coming up" } as const;

export function BriefView({ seller, items, drafts }: { seller: Seller; items: LedgerItem[]; drafts: ReplyDraft[] }) {
  const store = useStore();
  const draftByItem = useMemo(() => new Map(drafts.map((d) => [d.item, d])), [drafts]);
  const handled = Object.keys(store.items);

  const brief = useMemo(() => {
    // Items a founder assigned move to the assignee's brief.
    const withAssignments = items.map((i) => (store.assignments[i.id] ? { ...i, owner: store.assignments[i.id] } : i));
    return briefFor(seller, withAssignments, new Set(handled));
  }, [items, seller, store.assignments, handled.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const atRisk = brief.items.filter((i) => i.tier === 1).reduce((s, i) => s + (i.openValue ?? 0), 0);
  const overdue = brief.items.filter((i) => i.overdue).length;
  const handledHere = items.filter((i) => store.items[i.id]);

  let lastTier = 0;
  return (
    <>
      <div className="grid cols-4" style={{ margin: "12px 0 18px" }}>
        <div className="panel stat">
          <div className="n">{brief.items.length}</div>
          <div className="l">items on your brief (cap 10){brief.overflow ? `, ${brief.overflow} more below the cap` : ""}</div>
        </div>
        <div className="panel stat">
          <div className="n">{overdue}</div>
          <div className="l">overdue</div>
        </div>
        <div className="panel stat">
          <div className="n">{money(atRisk)}</div>
          <div className="l">deal value behind at-risk items</div>
        </div>
        <div className="panel stat">
          <div className="n">{brief.unassigned.length}</div>
          <div className="l">items with no owner{brief.unassigned.length ? " (see below)" : ""}</div>
        </div>
      </div>

      {brief.items.length === 0 && <p className="notice">Nothing needs you today.</p>}
      {brief.items.map((i, n) => {
        const head = i.tier !== lastTier ? <h2 key={`h${i.tier}`}>{TIER_LABEL[i.tier]}</h2> : null;
        lastTier = i.tier;
        return (
          <div key={i.id}>
            {head}
            <ItemCard item={i} rank={n + 1} tier={i.tier} draft={draftByItem.get(i.id)} />
          </div>
        );
      })}

      {brief.unassigned.length > 0 && (
        <>
          <h2>Needs an owner</h2>
          <p className="sub">Shown on every founder&apos;s and the CEO&apos;s brief until someone is assigned. Owners are proposed, never guessed.</p>
          {brief.unassigned.map((i) => (
            <ItemCard key={i.id} item={i} tier={i.tier} draft={draftByItem.get(i.id)} />
          ))}
        </>
      )}

      {handledHere.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary>{handledHere.length} item(s) you marked done, snoozed or dismissed</summary>
          {handledHere.map((i) => (
            <ItemCard key={i.id} item={i} draft={draftByItem.get(i.id)} />
          ))}
        </details>
      )}
    </>
  );
}

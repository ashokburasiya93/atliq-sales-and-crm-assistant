// F3 Daily Brief: deterministic, explainable ranking (cost estimate: "ranking is code").
import { addDays, TODAY } from "./dates";
import { ACTIONABLE } from "./ledger";
import { SEES_UNASSIGNED } from "./team";
import type { LedgerItem, Seller } from "./types";

export const BRIEF_CAP = 10;
export const AT_RISK_VALUE = 25000;
export const AT_RISK_DAYS = 14;
export const HORIZON_DAYS = 30;

export const RANKING_RULE = [
  `1. Money at risk: open deals of $${AT_RISK_VALUE / 1000}k or more that are overdue or due within ${AT_RISK_DAYS} days, largest deal first.`,
  "2. Overdue or due today: longest waiting first.",
  `3. Coming up in the next ${HORIZON_DAYS} days: earliest date first.`,
  `Capped at ${BRIEF_CAP} items. Unassigned items are listed separately on every founder's and the CEO's brief.`,
];

export type Tier = 1 | 2 | 3;

export function tierOf(i: LedgerItem): Tier | null {
  if (i.status !== "open" || !ACTIONABLE.has(i.type) || !i.dueDate) return null;
  const soon = addDays(TODAY, AT_RISK_DAYS);
  if ((i.openValue ?? 0) >= AT_RISK_VALUE && (i.overdue || i.dueDate <= soon)) return 1;
  if (i.dueDate <= TODAY) return 2;
  if ((i.rankDate ?? i.dueDate) <= addDays(TODAY, HORIZON_DAYS)) return 3;
  return null;
}

export function rank(items: LedgerItem[]): (LedgerItem & { tier: Tier })[] {
  return items
    .map((i) => ({ ...i, tier: tierOf(i) }))
    .filter((i): i is LedgerItem & { tier: Tier } => i.tier !== null)
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.tier === 1) return (b.openValue ?? 0) - (a.openValue ?? 0) || (a.dueDate! < b.dueDate! ? -1 : 1);
      if (a.tier === 2) return b.daysWaiting - a.daysWaiting;
      return (a.rankDate ?? "") < (b.rankDate ?? "") ? -1 : 1;
    });
}

export interface Brief {
  seller: Seller;
  items: (LedgerItem & { tier: Tier })[];
  unassigned: (LedgerItem & { tier: Tier })[];
  overflow: number;
}

/** Excluded ids are items the viewer has marked done, snoozed or dismissed. */
export function briefFor(seller: Seller, all: LedgerItem[], excluded: Set<string> = new Set()): Brief {
  const live = all.filter((i) => !excluded.has(i.id));
  const mine = rank(live.filter((i) => i.owner === seller));
  const unassigned = SEES_UNASSIGNED.includes(seller) ? rank(live.filter((i) => i.owner === "Unassigned")) : [];
  return { seller, items: mine.slice(0, BRIEF_CAP), unassigned, overflow: Math.max(0, mine.length - BRIEF_CAP) };
}

// F2 validation and the deterministic rules around the model's extraction:
// "no quote, no item", owner resolution, due dates, days waiting and overdue status.
import { addBusinessDays, addDays, daysBetween, maxIso, TODAY } from "./dates";
import { norm } from "./preprocess";
import type { Account, DroppedItem, LedgerItem, Quote, RawItem, Source, SourceLink } from "./types";

export const ACTIONABLE = new Set(["ask", "promise", "deadline", "revisit", "cross-sell", "referral"]);

export function quoteFound(q: Quote, sourceText: Map<string, string>): boolean {
  const text = sourceText.get(q.source);
  return !!text && !!q.text.trim() && text.includes(norm(q.text));
}

export function sourceTextIndex(sources: Source[], crmRaw: string): Map<string, string> {
  const m = new Map(sources.map((s) => [s.id, norm(s.text)]));
  m.set("crm_export", norm(crmRaw));
  return m;
}

export function buildLedger(
  raw: RawItem[],
  sources: Source[],
  crmRaw: string,
  accounts: Account[],
  links: SourceLink[],
  proposedOwners: Map<string, string>,
): { items: LedgerItem[]; dropped: DroppedItem[] } {
  const idx = sourceTextIndex(sources, crmRaw);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const linkBySource = new Map(links.map((l) => [l.sourceId, l]));
  const items: LedgerItem[] = [];
  const dropped: DroppedItem[] = [];

  for (const r of raw) {
    const account = accountById.get(r.account);
    if (!account) {
      dropped.push({ id: r.id, reason: `Unknown account ${r.account}` });
      continue;
    }
    if (!r.quotes.length) {
      dropped.push({ id: r.id, reason: "No quote, no item: the item has no source quote." });
      continue;
    }
    const missing = r.quotes.filter((q) => !quoteFound(q, idx));
    if (missing.length) {
      dropped.push({ id: r.id, reason: `Quote not found in ${missing[0].source}: "${missing[0].text}"` });
      continue;
    }
    let item: RawItem = r;
    if (r.done && !quoteFound(r.done, idx)) {
      // A completion claim must be grounded too; without it the item stays open.
      dropped.push({ id: `${r.id}:done`, reason: "Completion evidence not found in source; item kept open." });
      item = { ...r, status: "open", done: null };
    }

    const owner = account.isDraft ? account.draft?.proposedOwner || "Unassigned" : account.owner || "Unassigned";
    const twoDays = addBusinessDays(item.arose, 2);
    const dueDate = item.status === "signal" ? null : item.due ? maxIso(twoDays, item.due.end) : twoDays;
    const rankDate = item.status === "signal" ? null : item.due ? maxIso(twoDays, item.due.start) : twoDays;
    const accountUnconfirmed = item.quotes.some((q) => linkBySource.get(q.source)?.state === "unsure");
    // A Won deal's CRM value is past revenue, not pipeline. A Lost deal counts again only when
    // the client has re-engaged in the last 60 days (ClearPath, Kaveri), not for an old "check back".
    const status = account.crm?.status ?? "";
    const reEngaged = item.type === "revisit" && item.arose >= addDays(TODAY, -60);
    const openValue = status === "Won" || (status === "Lost" && !reEngaged) ? null : account.value;

    items.push({
      ...item,
      accountName: account.company,
      owner,
      proposedOwner: owner === "Unassigned" ? proposedOwners.get(account.id) : undefined,
      dueDate,
      rankDate,
      daysWaiting: Math.max(0, daysBetween(item.arose, TODAY)),
      overdue: item.status === "open" && !!dueDate && dueDate < TODAY,
      dealValue: account.value,
      openValue,
      accountUnconfirmed,
    });
  }
  return { items, dropped };
}

/** North Star: Commitments Kept on Time (PRD section 12.1). */
export function northStar(items: LedgerItem[], from = "2026-06-04", to = "2026-07-08") {
  const inScope = items.filter(
    (i) =>
      ["ask", "promise", "revisit", "referral", "cross-sell"].includes(i.type) &&
      i.status !== "signal" &&
      i.arose >= from &&
      i.arose <= to &&
      !!i.dueDate &&
      i.dueDate <= TODAY,
  );
  const kept = inScope.filter((i) => i.status === "done" && !!i.done?.date && i.done.date <= (i.dueDate as string));
  return { kept: kept.length, total: inScope.length, rate: inScope.length ? kept.length / inScope.length : 0, inScope };
}

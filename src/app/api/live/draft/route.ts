// Live F4 reply draft (strong tier). Context is one account's sources and ledger rows only.
import { NextResponse } from "next/server";
import { draftReply, liveEnabled, models } from "@/lib/llm";
import { memory } from "@/lib/memory";
import { checkDraft } from "@/lib/safety";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!liveEnabled()) return NextResponse.json({ error: "Live mode is off: no GROQ_API_KEY or ANTHROPIC_API_KEY is set on the server." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const m = memory();
  const item = m.items.find((i) => i.id === body.item);
  if (!item) return NextResponse.json({ error: "Unknown item." }, { status: 404 });
  if (item.restricted)
    return NextResponse.json({ error: `Blocked: ${item.restricted} requests are routed to a person and never drafted by AI.` }, { status: 403 });

  // Per-account context isolation: only sources whose primary link is this account.
  const sourceIds = new Set(
    m.links.filter((l) => l.primary === item.account && l.state !== "internal").map((l) => l.sourceId),
  );
  item.quotes.forEach((q) => {
    const l = m.links.find((x) => x.sourceId === q.source);
    if (l?.primary === item.account) sourceIds.add(q.source);
  });
  const sources = m.sources.filter((s) => sourceIds.has(s.id));
  const account = m.accounts.find((a) => a.id === item.account)!;
  const ledger = m.items
    .filter((i) => i.account === item.account)
    .map((i) => `- [${i.type}, ${i.status}] ${i.summary}`)
    .join("\n");
  const context = `${sources.map((s) => `## ${s.title} (${s.id})\n${s.text}`).join("\n\n")}\n\n## Ledger for this account\n${ledger}`;

  try {
    const text = await draftReply({ account: account.company, owner: item.owner === "Unassigned" ? "[blank: owner name]" : item.owner, ask: item.summary, context });
    const draft = { id: `live-${item.id}`, item: item.id, account: item.account, model: models().drafts, text, sources: [...sourceIds] };
    const safety = checkDraft(draft, m.accounts, m.sources);
    return NextResponse.json({ text, model: models().drafts, safety });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

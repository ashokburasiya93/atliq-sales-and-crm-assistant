// Live F1 + F2 for a pasted email or note: Haiku links it, Sonnet extracts, code verifies quotes.
import { NextResponse } from "next/server";
import { addBusinessDays, maxIso, TODAY } from "@/lib/dates";
import { extract, linkSource, liveEnabled, MAX_SOURCE_CHARS, MODELS } from "@/lib/llm";
import { memory } from "@/lib/memory";
import { norm, stripEditorial } from "@/lib/preprocess";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!liveEnabled()) return NextResponse.json({ error: "Live mode is off: ANTHROPIC_API_KEY is not set on the server." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.text === "string" ? body.text : "";
  if (!raw.trim()) return NextResponse.json({ error: "Paste an email or meeting note first." }, { status: 400 });
  if (raw.length > MAX_SOURCE_CHARS) return NextResponse.json({ error: `Keep it under ${MAX_SOURCE_CHARS} characters.` }, { status: 400 });

  const { text } = stripEditorial(raw);
  const m = memory();
  const accounts = m.accounts.filter((a) => !a.isDraft).map((a) => ({ id: a.id, company: a.company, contact: a.contact, email: a.email }));

  try {
    const link = await linkSource(text, accounts);
    const account = m.accounts.find((a) => a.id === link.accountId);
    const accountLabel = account ? `${account.company} (${account.id})` : link.newCompany || "unknown";
    const out = await extract(text, accountLabel);

    const src = norm(text);
    const kept: Record<string, unknown>[] = [];
    const dropped: { summary: string; reason: string }[] = [];
    for (const it of out.items) {
      const good = it.quotes.filter((q) => src.includes(norm(q)));
      if (!good.length) {
        dropped.push({ summary: it.summary, reason: "No quote found verbatim in the source" });
        continue;
      }
      const arose = /^\d{4}-\d{2}-\d{2}$/.test(it.arose) ? it.arose : TODAY;
      const twoDays = addBusinessDays(arose, 2);
      const dueDate = it.dueEnd && /^\d{4}-\d{2}-\d{2}$/.test(it.dueEnd) ? maxIso(twoDays, it.dueEnd) : twoDays;
      kept.push({
        ...it,
        quotes: good,
        droppedQuotes: it.quotes.length - good.length,
        owner: link.state === "new" ? "Unassigned (new lead)" : account?.owner || "Unassigned",
        dueDate,
        overdue: !["budget", "stakeholder"].includes(it.type) && dueDate < TODAY,
      });
    }
    const crmUpdates = out.crmUpdates.filter((u) => src.includes(norm(u.quote)));

    return NextResponse.json({
      models: { link: MODELS.capture, extraction: MODELS.extraction },
      link: { ...link, accountName: account?.company ?? null },
      items: kept,
      dropped,
      crmUpdates,
      note: "Nothing was written. CRM updates are proposals; approve them in your CRM workflow.",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

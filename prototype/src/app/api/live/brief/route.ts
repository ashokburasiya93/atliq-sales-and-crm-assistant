// Live F3: the fast tier rewrites the one-line summaries for a seller's brief from ledger facts only.
// The ranking itself stays deterministic code.
import { NextResponse } from "next/server";
import { briefLines, liveEnabled, models } from "@/lib/llm";
import { memory } from "@/lib/memory";
import { sellerFromSlug } from "@/lib/team";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!liveEnabled()) return NextResponse.json({ error: "Live mode is off: no GROQ_API_KEY or ANTHROPIC_API_KEY is set on the server." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const seller = sellerFromSlug(String(body.seller ?? ""));
  if (!seller) return NextResponse.json({ error: "Unknown seller." }, { status: 400 });
  const brief = memory().briefs[seller];
  const facts = brief.items.map((i) => ({
    id: i.id,
    facts: [
      `account ${i.accountName}`,
      `type ${i.type}`,
      `owed to ${i.owedTo}`,
      i.dueDate ? `due ${i.dueDate}${i.overdue ? " (overdue)" : ""}` : "",
      i.openValue ? `open deal value ${i.openValue} USD` : "",
      i.restricted ? `restricted: ${i.restricted}, a person prepares it` : "",
      `source says: "${i.quotes[0].text}"`,
    ]
      .filter(Boolean)
      .join("; "),
  }));
  try {
    const out = await briefLines(facts);
    return NextResponse.json({ model: models().brief, lines: out.lines });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

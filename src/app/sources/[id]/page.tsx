import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { memory } from "@/lib/memory";

export function generateStaticParams() {
  return memory().sources.map((s) => ({ id: s.id }));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlights every cited quote in the source text (whitespace- and quote-style-tolerant). */
function highlight(text: string, quotes: string[]): ReactNode[] {
  const ranges: [number, number][] = [];
  for (const q of quotes) {
    const pattern = q
      .trim()
      .split(/\s+/)
      .map((w) => escapeRe(w).replace(/['‘’]/g, "['‘’]").replace(/["“”]/g, '["“”]'))
      .join("\\s+");
    const m = new RegExp(pattern, "i").exec(text);
    if (m) ranges.push([m.index, m.index + m[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], i) => {
    if (s < pos) return;
    out.push(text.slice(pos, s));
    out.push(<mark key={i}>{text.slice(s, e)}</mark>);
    pos = e;
  });
  out.push(text.slice(pos));
  return out;
}

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = memory();
  const s = m.sources.find((x) => x.id === id);
  if (!s) notFound();
  const link = m.links.find((l) => l.sourceId === id)!;
  const name = (aid: string) => m.accounts.find((a) => a.id === aid)?.company ?? aid;
  const items = m.items.filter((i) => i.quotes.some((q) => q.source === id) || i.done?.source === id);
  const quotes = [
    ...items.flatMap((i) => i.quotes.filter((q) => q.source === id).map((q) => q.text)),
    ...items.filter((i) => i.done?.source === id).map((i) => i.done!.text),
    ...m.proposals.flatMap((p) => p.evidence.filter((q) => q.source === id).map((q) => q.text)),
  ];
  const display = s.text.replace(/\*\*/g, "");

  return (
    <>
      <div className="page-head">
        <h1>{s.title}</h1>
        <p className="sub">
          {s.file} · {s.kind === "email" ? `${s.messages.length} message(s)` : "meeting note"} · link state: {link.state}
          {link.primary && (
            <>
              {" "}
              · account: <Link href={`/accounts/${link.primary}`}>{name(link.primary)}</Link>
            </>
          )}
        </p>
        {link.reason && <p className="notice">{link.reason}</p>}
      </div>
      <div className="source-text">{highlight(display, quotes)}</div>
      <p className="sub" style={{ marginTop: 8 }}>
        Highlighted spans are the exact quotes cited by ledger items and proposals. The dataset&apos;s italic editorial notes ({s.editorial.length} here)
        were stripped before processing and are used only as eval ground truth.
      </p>
      <h2>Items citing this source ({items.length})</h2>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <Link href={`/accounts/${i.account}`}>{i.accountName}</Link>: {i.summary} <span className="chip grey">{i.status}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

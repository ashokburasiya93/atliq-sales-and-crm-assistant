import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefView } from "@/components/BriefView";
import { RANKING_RULE } from "@/lib/brief";
import { memory } from "@/lib/memory";
import { SELLERS, sellerFromSlug } from "@/lib/team";

export function generateStaticParams() {
  return SELLERS.map((s) => ({ seller: s.toLowerCase() }));
}

export default async function BriefPage({ params }: { params: Promise<{ seller: string }> }) {
  const { seller: slug } = await params;
  const seller = sellerFromSlug(slug);
  if (!seller) notFound();
  const m = memory();
  // The brief only sees this seller's accounts plus Unassigned items (PRD context per role).
  const items = m.items.filter((i) => i.owner === seller || i.owner === "Unassigned");
  const drafts = m.drafts.filter((d) => items.some((i) => i.id === d.item));
  const scanned = m.sources.length;

  return (
    <>
      <div className="page-head">
        <div className="row-flex">
          {SELLERS.map((s) => (
            <Link key={s} href={`/brief/${s.toLowerCase()}`} className="btn" style={s === seller ? { fontWeight: 700 } : undefined}>
              {s}
            </Link>
          ))}
        </div>
        <h1 style={{ marginTop: 14 }}>Good morning, {seller}</h1>
        <p className="sub">
          What needs you today, Friday 10 July 2026. Built at 08:00 IST from {scanned} sources scanned ({m.sources.filter((s) => s.kind === "email").length}{" "}
          email threads, {m.sources.filter((s) => s.kind === "note").length} meeting notes) and the 40-record CRM export. Every line cites its source.
        </p>
      </div>
      <BriefView seller={seller} items={items} drafts={drafts} />
      <details style={{ marginTop: 16 }}>
        <summary>How this brief is ranked</summary>
        <ul className="rule">
          {RANKING_RULE.map((r) => (
            <li key={r}>{r}</li>
          ))}
          <li>Ranking is plain code, not a model. One-line summaries restate ledger facts only ({m.models.brief}).</li>
        </ul>
      </details>
    </>
  );
}

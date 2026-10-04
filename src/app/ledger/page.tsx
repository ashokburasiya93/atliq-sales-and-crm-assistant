import { LedgerView } from "@/components/LedgerView";
import { memory } from "@/lib/memory";

export default function LedgerPage() {
  const m = memory();
  return (
    <>
      <div className="page-head">
        <h1>Commitment &amp; Signal Ledger</h1>
        <p className="sub">
          {m.items.length} items extracted by {m.models.extraction} from {m.sources.length} sources. No quote, no item: every row carries
          verbatim quotes that were re-checked against the source{m.dropped.length ? `; ${m.dropped.length} failed and were dropped` : ""}.
          Owners, due dates and overdue status are computed by rules.
        </p>
      </div>
      <LedgerView items={m.items} drafts={m.drafts} />
    </>
  );
}

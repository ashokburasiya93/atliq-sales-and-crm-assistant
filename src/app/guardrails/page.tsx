const GUARDRAILS = [
  {
    rule: "Never sends anything to a client",
    how: "There is no send code path and no mailbox permission. Reply drafts have a Copy button only; the seller sends from their own mail client.",
    where: "src/components/DraftPanel.tsx",
  },
  {
    rule: "Never writes to or merges CRM records without approval",
    how: "The CRM export is read-only. Every change is a proposal with evidence; only an approved one goes into the change file, logged with who and when. Duplicates (Meridian, GlobalMart) are flagged, never merged.",
    where: "src/lib/proposals.ts, src/components/ProposalRow.tsx",
  },
  {
    rule: "No quote, no item",
    how: "Every ledger item, completion claim, CRM proposal and draft lead must quote its source verbatim. The quote is checked against the cleaned source at build time and at runtime; failures are dropped and logged. The build fails if any shown item is uncited.",
    where: "src/lib/ledger.ts, scripts/verify.mts",
  },
  {
    rule: "Never invents prices, dates, scope or commitments",
    how: "Drafts leave unknown facts as [blank: ...]. The draft-safety check rejects any amount not present in that account's own sources.",
    where: "src/lib/safety.ts",
  },
  {
    rule: "Does not answer security questionnaires or write SOWs, proposals, pricing or contract terms",
    how: "These asks are classified as restricted, routed as a task with an owner and due date, and get no AI draft (the draft API refuses them too).",
    where: "src/components/ItemCard.tsx, src/app/api/live/draft/route.ts",
  },
  {
    rule: "No cross-client leakage",
    how: "A draft is generated from one account's sources only. The safety check fails a draft that names any other account's company or contact.",
    where: "src/app/api/live/draft/route.ts, src/lib/safety.ts",
  },
  {
    rule: "Uncertainty is visible; owners are never guessed",
    how: "Matches below the 0.75 confidence threshold, doubtful lead_ids ('L-1002?') and uncertain names ('Prakash? Prashant?') go to the Unsure queue with options. Items with no CRM owner show as Unassigned on every founder's brief with a proposed owner.",
    where: "src/lib/link.ts, src/app/approvals/page.tsx",
  },
  {
    rule: "Reads only AtliQ's own records",
    how: "Inputs are the CRM export, email threads and meeting notes. No web scraping, LinkedIn or enrichment. No lead scoring or win probability.",
    where: "scripts/build-data.mts",
  },
  {
    rule: "Editorial ground truth never reaches a model",
    how: "The dataset's italic editorial notes are stripped during pre-processing and used only by the evals.",
    where: "src/lib/preprocess.ts",
  },
  {
    rule: "Alert fatigue control",
    how: "The brief is capped at 10 items per seller with a ranking rule shown on the page; items can be snoozed or dismissed as wrong.",
    where: "src/lib/brief.ts",
  },
  {
    rule: "Fail safe",
    how: "Unreadable or unmatched files go to the Unlinked inbox, never silently dropped. Without an API key the app serves the verified precomputed outputs.",
    where: "scripts/build-data.mts, src/app/sources/page.tsx",
  },
  {
    rule: "Selling only",
    how: "Delivery and project-execution work is out of scope; the app sits on top of the CRM and does not replace it.",
    where: "-",
  },
];

export default function GuardrailsPage() {
  return (
    <>
      <div className="page-head">
        <h1>Guardrails</h1>
        <p className="sub">
          The opportunity map&apos;s &quot;should NOT&quot; list and the PRD&apos;s guardrails, and where this prototype enforces each one.
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Guardrail</th>
              <th>How it is enforced</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {GUARDRAILS.map((g) => (
              <tr key={g.rule}>
                <td>
                  <strong>{g.rule}</strong>
                </td>
                <td>{g.how}</td>
                <td className="sub">
                  <code>{g.where}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

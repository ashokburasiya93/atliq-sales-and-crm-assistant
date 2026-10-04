import { memory } from "@/lib/memory";

export default function EvalsPage() {
  const m = memory();
  const passed = m.evals.filter((e) => e.pass).length;
  return (
    <>
      <div className="page-head">
        <h1>Evals</h1>
        <p className="sub">
          PRD section 11 launch criteria, recomputed over the dataset on every build. {passed}/{m.evals.length} pass. The build fails if citation
          faithfulness or draft safety fails.
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Eval</th>
              <th>Threshold</th>
              <th>Result</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {m.evals.map((e) => (
              <tr key={e.name}>
                <td>
                  <strong>{e.name}</strong>
                  <div className="sub">{e.definition}</div>
                </td>
                <td>{e.threshold}</td>
                <td>{e.value}</td>
                <td className={e.pass ? "pass" : "fail"}>{e.pass ? "PASS" : "FAIL"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m.evals.map((e) => (
        <details key={e.name} style={{ marginTop: 12 }}>
          <summary>
            {e.name}: {e.detail.filter((d) => !d.ok).length} miss(es) of {e.detail.length} checks
          </summary>
          <ul className="rule">
            {[...e.detail]
              .sort((a, b) => Number(a.ok) - Number(b.ok))
              .map((d, i) => (
                <li key={i}>
                  <span className={d.ok ? "pass" : "fail"}>{d.ok ? "ok" : "miss"}</span> {d.label}
                  {d.note ? <span className="sub"> ({d.note})</span> : null}
                </li>
              ))}
          </ul>
        </details>
      ))}
      <h2>Model split (Step 4 cost estimate)</h2>
      <ul className="rule">
        <li>F1 Capture &amp; Link: {m.models.capture}</li>
        <li>F2 Ledger extraction and CRM proposals: {m.models.extraction}</li>
        <li>F3 Brief one-liners: {m.models.brief}; ranking is code</li>
        <li>F4 Reply drafts: {m.models.drafts}</li>
      </ul>
    </>
  );
}

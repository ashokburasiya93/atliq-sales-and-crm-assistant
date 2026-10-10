"use client";
import { useStore } from "@/components/store";

export default function AuditPage() {
  const { log, reset } = useStore();
  return (
    <>
      <div className="page-head">
        <h1>Audit log</h1>
        <p className="sub">
          Every approval, rejection, edit, assignment and item state change, with who and when. In this prototype the log lives in your browser; in
          production it is kept for 12 months (PRD section 5).
        </p>
      </div>
      {log.length === 0 ? (
        <p className="notice">No decisions yet. Approve or reject a proposal, or mark an item done, and it appears here.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e, i) => (
                <tr key={i}>
                  <td>{new Date(e.at).toLocaleString()}</td>
                  <td>{e.by}</td>
                  <td>{e.action}</td>
                  <td>
                    {e.detail}
                    <div className="sub">{e.target}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 16 }}>
        <button className="danger" onClick={() => confirm("Clear all decisions and the log in this browser?") && reset()}>
          Reset demo state
        </button>
      </p>
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import { SELLERS } from "@/lib/team";

const SAMPLE = `From: Rhea Sharma <rhea@nimbuslending.in>
To: Bhavin <bhavin@atliq.com>
Date: 2026-07-10

Bhavin, following up on Shreya's intro. Our CFO has asked to see a short outline of how you'd approach automated document review before the 20 July budget meeting. Could you send something by Wednesday? Also, our Head of Credit, Arun Mehta, will join the call.`;

type Json = Record<string, unknown>;

export default function LivePage() {
  const [status, setStatus] = useState<{ enabled: boolean; models?: Json; unreachable?: boolean } | null>(null);
  const [text, setText] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Json | null>(null);
  const [error, setError] = useState("");
  const [seller, setSeller] = useState("Bhavin");
  const [lines, setLines] = useState<{ id: string; line: string }[] | null>(null);

  useEffect(() => {
    fetch("/api/live")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, unreachable: true }));
  }, []);

  async function post(url: string, body: Json) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Request failed");
      return j;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const items = (result?.items as Json[] | undefined) ?? [];
  const dropped = (result?.dropped as Json[] | undefined) ?? [];
  const link = result?.link as Json | undefined;
  const updates = (result?.crmUpdates as Json[] | undefined) ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Live mode</h1>
        <p className="sub">
          Run the pipeline on a new email or note with real models: a fast model links it to an account, a stronger model extracts asks, promises
          and signals with quotes, and code drops anything whose quote is not in the text. Nothing is written or sent.
        </p>
        {status?.enabled && status.models && (
          <p className="notice">
            Provider: {String(status.models.provider)} · fast tier {String(status.models.capture)} (linking, brief lines) · strong tier{" "}
            {String(status.models.extraction)} (extraction, drafts)
          </p>
        )}
        {status?.unreachable && (
          <p className="notice warn">Couldn't reach the server to check live mode. Reload the page; if it persists, open https://atliq-sales-and-crm-assistant.vercel.app/live directly.</p>
        )}
        {status && !status.enabled && !status.unreachable && (
          <p className="notice warn">
            Live mode is off because no GROQ_API_KEY or ANTHROPIC_API_KEY is set on the server. Everything else in the app runs on the precomputed, verified
            outputs. To turn it on, set the key as an environment variable (locally or in Vercel project settings) and redeploy.
          </p>
        )}
      </div>

      <h2>1. Capture a new email or note</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Email or meeting note" />
      <div className="actions">
        <button className="primary" disabled={busy || !status?.enabled} onClick={async () => setResult(await post("/api/live/ingest", { text }))}>
          {busy ? "Running..." : "Link and extract"}
        </button>
      </div>
      {error && <p className="notice warn">{error}</p>}
      {link && (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3>Link ({String((result?.models as Json)?.link ?? "")})</h3>
          <p>
            <span className={`chip ${link.state === "confident" ? "green" : "amber"}`}>{String(link.state)}</span>{" "}
            {String(link.accountName ?? link.newCompany ?? "")} {link.accountId ? `(${String(link.accountId)})` : ""}
          </p>
          <p className="sub">{String(link.reason)}</p>
        </div>
      )}
      {result && (
        <>
          <h3 style={{ marginTop: 14 }}>
            Ledger items ({items.length} kept, {dropped.length} dropped for missing quotes) by {String((result.models as Json)?.extraction)}
          </h3>
          {items.map((i, n) => (
            <div className="card" key={n}>
              <div className="card-top">
                <span className="summary">{String(i.summary)}</span>
                <span className="chip grey">{String(i.type)}</span>
                {Boolean(i.restricted) && <span className="chip violet">restricted: {String(i.restricted)}</span>}
                {Boolean(i.overdue) && <span className="chip red">overdue</span>}
              </div>
              <div className="meta">
                <span>Owner: {String(i.owner)}</span>
                <span>Due {String(i.dueDate)}{i.dueText ? ` ("${String(i.dueText)}")` : ""}</span>
                <span>Confidence {Math.round(Number(i.confidence) * 100)}%</span>
              </div>
              <ul className="quotes">
                {(i.quotes as string[]).map((q) => (
                  <li key={q}>
                    <q>{q}</q>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {dropped.map((d, n) => (
            <p key={n} className="sub">
              Dropped: {String(d.summary)} ({String(d.reason)})
            </p>
          ))}
          {updates.length > 0 && (
            <>
              <h3>Proposed CRM updates (need approval)</h3>
              <ul>
                {updates.map((u, n) => (
                  <li key={n}>
                    {String(u.field)} → {String(u.proposed)} <span className="sub">(&quot;{String(u.quote)}&quot;)</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <h2>2. Rewrite a seller&apos;s brief lines</h2>
      <p className="sub">The fast model restates ledger facts as one-liners. Ranking stays in code.</p>
      <div className="actions">
        <select value={seller} onChange={(e) => setSeller(e.target.value)} aria-label="Seller">
          {SELLERS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          disabled={busy || !status?.enabled}
          onClick={async () => {
            const j = await post("/api/live/brief", { seller });
            setLines(j?.lines ?? null);
          }}
        >
          Generate brief lines
        </button>
      </div>
      {lines && (
        <ol>
          {lines.map((l) => (
            <li key={l.id}>
              {l.line} <span className="sub">({l.id})</span>
            </li>
          ))}
        </ol>
      )}
      <p className="sub" style={{ marginTop: 20 }}>
        Reply drafts can also be regenerated live from any item&apos;s &quot;Reply draft&quot; panel.
      </p>
    </>
  );
}

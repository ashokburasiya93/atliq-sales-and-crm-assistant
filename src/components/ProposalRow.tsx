"use client";
import Link from "next/link";
import { useState } from "react";
import type { CrmProposal } from "@/lib/types";
import { Quotes } from "./bits";
import { useStore } from "./store";

const FIELD_LABEL: Record<string, string> = {
  merge: "Possible duplicate",
  create: "New lead",
  next_followup_date: "Next follow-up date",
  est_value_usd: "Est. value (USD)",
  last_contact_date: "Last contact date",
  service_interest: "Service interest",
};

export function ProposalRow({ p, accountName }: { p: CrmProposal; accountName: string }) {
  const store = useStore();
  const decision = store.decisions[p.id];
  const [value, setValue] = useState(decision?.value ?? (p.options && !p.proposed ? "" : p.proposed));
  const label = `${accountName} ${FIELD_LABEL[p.field] ?? p.field}`;
  const needsChoice = !!p.options && (p.field === "merge" || !p.proposed);

  return (
    <div className={`card ${decision ? "muted" : ""}`}>
      <div className="card-top">
        <span className="summary">
          <Link href={`/accounts/${p.account}`}>{accountName}</Link> · {FIELD_LABEL[p.field] ?? p.field}
        </span>
        <span className={`chip ${p.origin === "rule" ? "grey" : "blue"}`}>{p.origin === "rule" ? "rule" : "model"}</span>
        <span className={`chip ${p.confidence < 0.75 ? "amber" : "grey"}`}>confidence {Math.round(p.confidence * 100)}%</span>
        {decision && (
          <span className={`chip ${decision.action === "approved" ? "green" : "red"}`}>
            {decision.action} by {decision.by}
          </span>
        )}
      </div>
      <div className="meta">
        <span>Current: {p.current || <em>blank</em>}</span>
        {p.field !== "merge" && <span>Proposed: {p.proposed || <em>needs your choice</em>}</span>}
        {p.field === "merge" && <span>{p.proposed}</span>}
      </div>
      {p.note && <p className="sub">{p.note}</p>}
      <Quotes quotes={p.evidence} />
      {!decision ? (
        <div className="actions">
          {needsChoice ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Choose a value">
              <option value="">{p.field === "merge" ? "Keep which record?" : "Choose..."}</option>
              {p.options!.map((o) => (
                <option key={o} value={o}>
                  {p.field === "merge" ? `Keep ${o}` : o}
                </option>
              ))}
            </select>
          ) : (
            p.field !== "create" && (
              <input type="text" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Edit proposed value" style={{ minWidth: 240 }} />
            )
          )}
          <button
            className="primary"
            disabled={needsChoice && !value}
            onClick={() => store.decide(p.id, label, "approved", p.field === "create" ? p.proposed : value)}
          >
            {value !== p.proposed && p.field !== "create" && !needsChoice ? "Approve edited" : "Approve"}
          </button>
          <button className="danger" onClick={() => store.decide(p.id, label, "rejected")}>
            Reject
          </button>
        </div>
      ) : (
        <div className="actions">
          {decision.value !== undefined && decision.action === "approved" && <span className="sub">Applied value: {decision.value}</span>}
          <button onClick={() => store.undoDecision(p.id, label)}>Undo</button>
        </div>
      )}
    </div>
  );
}

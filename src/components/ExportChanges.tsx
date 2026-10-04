"use client";
import { useStore } from "./store";

interface Row {
  id: string;
  account: string;
  company: string;
  field: string;
  current: string;
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function ExportChanges({ proposals }: { proposals: Row[] }) {
  const { decisions } = useStore();
  const approved = proposals.filter((p) => decisions[p.id]?.action === "approved");
  const rejected = proposals.filter((p) => decisions[p.id]?.action === "rejected").length;

  function download() {
    const header = ["lead_id", "company", "field", "old_value", "new_value", "approved_by", "approved_at", "proposal_id"];
    const lines = approved.map((p) => {
      const d = decisions[p.id];
      return [p.account, p.company, p.field, p.current, d.value ?? "", d.by, d.at, p.id].map((x) => csvCell(String(x))).join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "approved_crm_changes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="notice row-flex">
      <span>
        {approved.length} approved, {rejected} rejected, {proposals.length - approved.length - rejected} waiting.
      </span>
      <button onClick={download} disabled={!approved.length}>
        Download approved change file (CSV)
      </button>
    </div>
  );
}

"use client";
import { useState } from "react";
import type { ReplyDraft } from "@/lib/types";
import { DraftText } from "./bits";
import { useStore } from "./store";

export function DraftPanel({ draft, itemLabel }: { draft: ReplyDraft; itemLabel: string }) {
  const store = useStore();
  const [text, setText] = useState(draft.text);
  const [model, setModel] = useState(draft.model);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Copied. Paste it into your own mail client, fill the blanks and send it yourself.");
      store.decide(`draft:${draft.id}`, `Reply draft copied (${itemLabel})`, "approved");
    } catch {
      setMsg("Copy failed. Select the text and copy it manually.");
    }
  }

  async function regenerate() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/live/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item: draft.item }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Request failed");
      setText(j.text);
      setModel(j.model);
      setMsg(j.safety?.ok ? "Regenerated from this account's sources only. Safety check passed." : `Safety check flagged: ${JSON.stringify(j.safety)}`);
    } catch (e) {
      setMsg(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <DraftText text={text} />
      <div className="actions">
        <button onClick={copy}>Copy text</button>
        <button onClick={regenerate} disabled={busy}>
          {busy ? "Regenerating..." : "Regenerate (live)"}
        </button>
        <span className="sub">
          Draft by {model} from {draft.sources.length} source(s) on this account. Copy only: nothing is ever sent.
        </span>
      </div>
      {msg && <p className="sub" style={{ marginTop: 6 }}>{msg}</p>}
    </div>
  );
}

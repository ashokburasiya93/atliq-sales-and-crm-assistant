"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SELLERS } from "@/lib/team";
import type { Seller } from "@/lib/types";
import { useStore } from "./store";

const NAV = [
  { href: "/brief/bhavin", label: "Daily brief", match: "/brief" },
  { href: "/ledger", label: "Ledger", match: "/ledger" },
  { href: "/accounts", label: "Accounts", match: "/accounts" },
  { href: "/approvals", label: "Approvals", match: "/approvals" },
  { href: "/pack", label: "Review pack", match: "/pack" },
  { href: "/sources", label: "Sources", match: "/sources" },
  { href: "/evals", label: "Evals", match: "/evals" },
  { href: "/live", label: "Live mode", match: "/live" },
  { href: "/audit", label: "Audit log", match: "/audit" },
  { href: "/guardrails", label: "Guardrails", match: "/guardrails" },
];

export function TopBar() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    fetch("/api/live")
      .then((r) => r.json())
      .then((j) => setLive(!!j.enabled))
      .catch(() => setLive(false));
  }, []);
  const path = usePathname() ?? "";
  const { actingAs, setActingAs } = useStore();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          AtliQ Sales Memory<small>prototype</small>
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path.startsWith(n.match) ? "active" : ""}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="topbar-right">
          <span className={`chip ${live ? "green" : "grey"}`} title="Live mode needs GROQ_API_KEY or ANTHROPIC_API_KEY on the server">
            {live ? "Live models on" : "Precomputed outputs"}
          </span>
          <label>
            Acting as{" "}
            <select value={actingAs} onChange={(e) => setActingAs(e.target.value as Seller)} aria-label="Acting as">
              {SELLERS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}

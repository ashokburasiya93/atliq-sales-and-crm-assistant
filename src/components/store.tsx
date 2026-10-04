"use client";
// Seller decisions for the prototype: approvals, item states, assignments and the audit log.
// Stored in this browser only (no database on the free tier). Nothing here ever reaches a client:
// approved CRM changes are exported as a change file for the CRM, and drafts are copy-only.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Seller } from "@/lib/types";

export type ItemAction = "done" | "snoozed" | "dismissed";

export interface Decision {
  action: "approved" | "rejected";
  value?: string;
  by: Seller;
  at: string;
}

export interface AuditEntry {
  at: string;
  by: Seller;
  action: string;
  target: string;
  detail: string;
}

interface State {
  actingAs: Seller;
  items: Record<string, { status: ItemAction; by: Seller; at: string }>;
  assignments: Record<string, Seller>;
  decisions: Record<string, Decision>;
  log: AuditEntry[];
}

const KEY = "atliq-sales-memory-v1";
const EMPTY: State = { actingAs: "Bhavin", items: {}, assignments: {}, decisions: {}, log: [] };

interface Store extends State {
  setActingAs(s: Seller): void;
  markItem(id: string, label: string, status: ItemAction): void;
  undoItem(id: string, label: string): void;
  assign(id: string, label: string, to: Seller): void;
  decide(id: string, label: string, action: Decision["action"], value?: string): void;
  undoDecision(id: string, label: string): void;
  reset(): void;
  ready: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable: run with in-memory state */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, ready]);

  const log = useCallback((s: State, action: string, target: string, detail: string): AuditEntry[] => {
    return [{ at: new Date().toISOString(), by: s.actingAs, action, target, detail }, ...s.log].slice(0, 500);
  }, []);

  const store = useMemo<Store>(
    () => ({
      ...state,
      ready,
      setActingAs: (actingAs) => setState((s) => ({ ...s, actingAs })),
      markItem: (id, label, status) =>
        setState((s) => ({
          ...s,
          items: { ...s.items, [id]: { status, by: s.actingAs, at: new Date().toISOString() } },
          log: log(s, `item ${status}`, id, label),
        })),
      undoItem: (id, label) =>
        setState((s) => {
          const items = { ...s.items };
          delete items[id];
          return { ...s, items, log: log(s, "item reopened", id, label) };
        }),
      assign: (id, label, to) =>
        setState((s) => ({
          ...s,
          assignments: { ...s.assignments, [id]: to },
          log: log(s, "item assigned", id, `${label} -> ${to}`),
        })),
      decide: (id, label, action, value) =>
        setState((s) => ({
          ...s,
          decisions: { ...s.decisions, [id]: { action, value, by: s.actingAs, at: new Date().toISOString() } },
          log: log(s, `proposal ${action}`, id, value !== undefined ? `${label} = ${value}` : label),
        })),
      undoDecision: (id, label) =>
        setState((s) => {
          const decisions = { ...s.decisions };
          delete decisions[id];
          return { ...s, decisions, log: log(s, "decision undone", id, label) };
        }),
      reset: () => setState({ ...EMPTY, actingAs: state.actingAs }),
    }),
    [state, ready, log],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

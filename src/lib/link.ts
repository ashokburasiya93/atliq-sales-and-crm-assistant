// F1 Capture & Link: deterministic matching first (contact email, email domain, lead_id,
// company name), then the model's resolutions for what the rules cannot place
// (new companies, referral intros, doubtful lead_id mentions). Never merges records.
import type { Account, CrmRecord, LinkEdge, Source, SourceLink } from "./types";

export const LINK_THRESHOLD = 0.75;
const ATLIQ_DOMAIN = "atliq.com";

export interface Resolution {
  source: string;
  state: "new" | "unsure";
  primary: string;
  referrer?: string;
  reason: string;
}

export function companyKey(company: string): string {
  const first = company.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  return first;
}

function domainOf(email: string): string {
  return email.split("@")[1] ?? "";
}

/** Duplicate groups: same contact email, or same email domain and same company key. */
export function duplicateGroups(crm: CrmRecord[]): string[][] {
  const groups: string[][] = [];
  const seen = new Set<string>();
  for (const a of crm) {
    if (seen.has(a.lead_id)) continue;
    const group = [a.lead_id];
    for (const b of crm) {
      if (b.lead_id === a.lead_id || seen.has(b.lead_id)) continue;
      const sameEmail = a.contact_email && a.contact_email === b.contact_email;
      const sameDomainAndName =
        a.contact_email &&
        b.contact_email &&
        domainOf(a.contact_email) === domainOf(b.contact_email) &&
        companyKey(a.company) === companyKey(b.company);
      if (sameEmail || sameDomainAndName) group.push(b.lead_id);
    }
    if (group.length > 1) {
      group.sort();
      group.forEach((g) => seen.add(g));
      groups.push(group);
    }
  }
  return groups;
}

export function linkSources(
  sources: Source[],
  crm: CrmRecord[],
  accounts: Account[],
  resolutions: Resolution[],
): SourceLink[] {
  const groups = duplicateGroups(crm);
  const primaryOf = new Map<string, string>();
  for (const g of groups) for (const id of g) primaryOf.set(id, g[0]);
  const byEmail = new Map(crm.filter((c) => c.contact_email).map((c) => [c.contact_email, c]));
  const keys = crm.map((c) => ({ id: c.lead_id, key: companyKey(c.company) })).filter((k) => k.key.length >= 4);
  const resolved = new Map(resolutions.map((r) => [r.source, r]));
  const accountIds = new Set(accounts.map((a) => a.id));

  return sources.map((s) => {
    const edges = new Map<string, LinkEdge>();
    const add = (id: string, confidence: number, method: string, role: LinkEdge["role"] = "mention") => {
      const primaryId = primaryOf.get(id) ?? id;
      const m = primaryId !== id ? `${method} (duplicate record ${id})` : method;
      const cur = edges.get(primaryId);
      if (!cur || cur.confidence < confidence) edges.set(primaryId, { accountId: primaryId, confidence, method: m, role });
    };

    const firstSender = s.messages[0]?.from?.email ?? "";
    for (const p of s.participants) {
      if (!p.email || p.email.endsWith(ATLIQ_DOMAIN)) continue;
      const exact = byEmail.get(p.email);
      if (exact) {
        // GlobalMart has the same contact on two records: link both, collapse to the group primary.
        for (const c of crm.filter((c) => c.contact_email === p.email))
          add(c.lead_id, p.email === firstSender ? 0.99 : 0.98, "contact email");
        continue;
      }
      for (const c of crm)
        if (c.contact_email && domainOf(c.contact_email) === domainOf(p.email)) add(c.lead_id, 0.9, "email domain");
    }

    for (const m of s.text.matchAll(/\bL-(\d{4})(\?)?/g)) {
      const id = `L-${m[1]}`;
      if (!crm.some((c) => c.lead_id === id)) continue;
      add(id, m[2] ? 0.55 : 0.95, m[2] ? "lead_id cited with doubt" : "lead_id cited");
    }

    const title = s.title.toLowerCase();
    const body = s.text.toLowerCase();
    for (const k of keys) {
      const re = new RegExp(`\\b${k.key}`);
      if (re.test(title)) add(k.id, 0.96, "company name in title");
      else if (re.test(body)) add(k.id, 0.7, "company name mentioned");
    }

    const list = [...edges.values()].sort((a, b) => b.confidence - a.confidence);
    const res = resolved.get(s.id);
    if (res && accountIds.has(res.primary)) {
      const others = list.filter((e) => e.accountId !== res.primary && e.accountId !== res.referrer);
      const out: LinkEdge[] = [
        {
          accountId: res.primary,
          confidence: res.state === "unsure" ? 0.6 : 0.9,
          method: res.state === "unsure" ? "model: needs confirmation" : "model: new company",
          role: res.state === "unsure" ? "candidate" : "primary",
        },
      ];
      if (res.referrer) out.push({ accountId: res.referrer, confidence: 0.95, method: "model: referrer", role: "referrer" });
      out.push(...others.map((e) => ({ ...e, role: "mention" as const })));
      return { sourceId: s.id, state: res.state, primary: res.primary, edges: out, reason: res.reason };
    }

    const internal = s.kind === "note" && /^internal|debrief/i.test(s.title);
    if (internal) {
      return {
        sourceId: s.id,
        state: "internal",
        primary: null,
        edges: list.map((e) => ({ ...e, role: "mention" as const })),
        reason: "Internal meeting that mentions several accounts.",
      };
    }
    if (!list.length) {
      return { sourceId: s.id, state: "unlinked", primary: null, edges: [], reason: "No account matched. Sent to the Unlinked inbox." };
    }
    const top = list[0];
    if (top.confidence < LINK_THRESHOLD) {
      return {
        sourceId: s.id,
        state: "unsure",
        primary: null,
        edges: list.map((e) => ({ ...e, role: "candidate" as const })),
        reason: `Best match ${top.accountId} is below the ${LINK_THRESHOLD} threshold.`,
      };
    }
    return {
      sourceId: s.id,
      state: "confident",
      primary: top.accountId,
      edges: list.map((e, i) => ({ ...e, role: i === 0 ? ("primary" as const) : ("mention" as const) })),
    };
  });
}

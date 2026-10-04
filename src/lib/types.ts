// Shared types for AtliQ Sales Memory.

export type Seller = "Bhavin" | "Dhaval" | "Karandeep" | "Jay";

export interface Person {
  name: string;
  email?: string;
}

export interface SourceMessage {
  from: Person | null;
  to: Person[];
  date: string | null;
  body: string;
}

/** One email thread or meeting note, after pre-processing (editorial notes stripped). */
export interface Source {
  id: string;
  kind: "email" | "note";
  file: string;
  title: string;
  date: string;
  participants: Person[];
  messages: SourceMessage[];
  /** Full cleaned text. Every quote must be found in here. */
  text: string;
  /** The dataset's italic editorial notes. Never shown to a model; eval ground truth only. */
  editorial: string[];
}

export interface CrmRecord {
  lead_id: string;
  company: string;
  contact_name: string;
  contact_email: string;
  source: string;
  service_interest: string;
  status: string;
  est_value_usd: number | null;
  owner: string;
  created_date: string;
  last_contact_date: string;
  next_followup_date: string;
  notes: string;
}

export interface Quote {
  source: string;
  text: string;
}

export interface DateWindow {
  text: string;
  start: string;
  end: string;
  approximate?: boolean;
}

export type ItemType =
  | "ask"
  | "promise"
  | "deadline"
  | "revisit"
  | "cross-sell"
  | "referral"
  | "budget"
  | "stakeholder";

/** A ledger row as produced by F2 extraction (precomputed or live). */
export interface RawItem {
  id: string;
  account: string;
  type: ItemType;
  summary: string;
  owedBy: string;
  owedTo: string;
  arose: string;
  due?: DateWindow | null;
  clientDeadline?: DateWindow | null;
  quotes: Quote[];
  status: "open" | "done" | "signal";
  done?: { date?: string; source: string; text: string } | null;
  restricted?: string | null;
  routedTo?: string | null;
  routeAccepted?: boolean;
  opportunity?: string | null;
  confidence: number;
}

/** A ledger row after validation, owner resolution and date rules. */
export interface LedgerItem extends RawItem {
  accountName: string;
  owner: string; // a seller, or "Unassigned"
  proposedOwner?: string;
  dueDate: string | null; // the date the item is overdue after
  rankDate: string | null; // earliest plausible date, used for ranking
  daysWaiting: number;
  overdue: boolean;
  dealValue: number | null;
  /** Value of a live opportunity: excludes Won deals and Lost deals that have not re-engaged. */
  openValue: number | null;
  accountUnconfirmed: boolean;
}

export interface DroppedItem {
  id: string;
  reason: string;
}

export interface Account {
  id: string;
  company: string;
  contact: string;
  email: string;
  owner: string;
  status: string;
  value: number | null;
  isDraft: boolean;
  crm?: CrmRecord;
  draft?: DraftLead;
}

export interface DraftLead {
  id: string;
  company: string;
  contact: string;
  email: string;
  source: string;
  referrer: string;
  serviceInterest: string;
  proposedOwner: string;
  contactUncertain?: string[];
  evidence: Quote[];
}

export interface LinkEdge {
  accountId: string;
  confidence: number;
  method: string;
  role: "primary" | "mention" | "referrer" | "candidate";
}

export interface SourceLink {
  sourceId: string;
  state: "confident" | "unsure" | "new" | "internal" | "unlinked";
  primary: string | null;
  edges: LinkEdge[];
  reason?: string;
}

export interface CrmProposal {
  id: string;
  account: string;
  field: keyof CrmRecord | "merge" | "create";
  current: string;
  proposed: string;
  options?: string[];
  evidence: Quote[];
  confidence: number;
  origin: "model" | "rule";
  note?: string;
}

export interface ReplyDraft {
  id: string;
  item: string;
  account: string;
  model: string;
  text: string;
  sources: string[];
}

export interface DraftSafety {
  draftId: string;
  blanks: number;
  foreignEntities: string[];
  unsupportedAmounts: string[];
  ok: boolean;
}

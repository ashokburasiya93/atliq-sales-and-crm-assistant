// F1 step 1: pre-process raw dataset files.
// Strips the dataset's italic editorial notes "*( ... )*" (kept aside as eval ground truth only),
// splits email threads into messages and records sender, recipients and dates.
import type { CrmRecord, Person, Source, SourceMessage } from "./types";

const EDITORIAL = /\*\(([\s\S]*?)\)\*/g;
const PERSON = /([^<>,:*]+?)\s*<([^<>\s]+@[^<>\s]+)>/g;

export function stripEditorial(raw: string): { text: string; editorial: string[] } {
  const editorial: string[] = [];
  const text = raw.replace(EDITORIAL, (_m, inner: string) => {
    editorial.push(inner.trim());
    return "";
  });
  return { text: text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), editorial };
}

function parsePeople(line: string): Person[] {
  const out: Person[] = [];
  for (const m of line.matchAll(PERSON)) {
    out.push({ name: m[1].replace(/^(CC|Cc):\s*/i, "").trim(), email: m[2].toLowerCase() });
  }
  return out;
}

function field(block: string, name: string): string | null {
  const m = block.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`, "i"));
  return m ? m[1].trim() : null;
}

export function parseSource(file: string, raw: string): Source {
  const kind = file.startsWith("emails/") ? "email" : "note";
  const base = file.split("/").pop()!.replace(/\.md$/, "");
  const { text, editorial } = stripEditorial(raw);
  const titleLine = text.split("\n").find((l) => l.startsWith("# ")) ?? base;
  const title = titleLine
    .replace(/^#\s*/, "")
    .replace(/^(Email Thread|Email|Meeting Notes|Notes):\s*/i, "")
    .trim();
  const date = base.slice(0, 10);

  const messages: SourceMessage[] = [];
  const participants = new Map<string, Person>();
  if (kind === "email") {
    const body = text.replace(/^#.*\n/, "");
    for (const block of body.split(/\n---\n/)) {
      const fromLine = field(block, "From");
      const toLine = field(block, "To") ?? "";
      const ccLine = field(block, "Cc") ?? "";
      const from = fromLine ? parsePeople(fromLine)[0] ?? null : null;
      const to = [...parsePeople(toLine), ...parsePeople(ccLine)];
      const bodyText = block
        .split("\n")
        .filter((l) => !/^\*\*(From|To|Cc|Date|Subject):\*\*/i.test(l.trim()))
        .join("\n")
        .trim();
      messages.push({ from, to, date: field(block, "Date"), body: bodyText });
      for (const p of [from, ...to]) if (p?.email) participants.set(p.email, p);
    }
  } else {
    messages.push({ from: null, to: [], date, body: text.replace(/^#.*\n/, "").trim() });
  }

  return {
    id: base,
    kind,
    file,
    title,
    date,
    participants: [...participants.values()],
    messages,
    text,
    editorial,
  };
}

/** Minimal RFC-4180 CSV parser (handles quoted fields with commas). */
export function parseCsv(raw: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quoted) {
      if (c === '"' && raw[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export function toCrm(rows: Record<string, string>[]): CrmRecord[] {
  return rows.map((r) => ({
    lead_id: r.lead_id,
    company: r.company,
    contact_name: r.contact_name,
    contact_email: r.contact_email.toLowerCase(),
    source: r.source,
    service_interest: r.service_interest,
    status: r.status,
    est_value_usd: r.est_value_usd ? Number(r.est_value_usd) : null,
    owner: r.owner,
    created_date: r.created_date,
    last_contact_date: r.last_contact_date,
    next_followup_date: r.next_followup_date,
    notes: r.notes,
  }));
}

/** Whitespace- and quote-style-insensitive normaliser used for the "quote must be in source" check. */
export function norm(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Date rules from PRD section 9.3: due = later of (2 business days after the item arose)
// and the client's or promised date. Dates are ISO yyyy-mm-dd strings in IST business days.

export const TODAY = "2026-07-10";

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isWeekend(iso: string): boolean {
  const day = toDate(iso).getUTCDay();
  return day === 0 || day === 6;
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

export function addBusinessDays(iso: string, n: number): string {
  let cur = iso;
  let left = n;
  while (left > 0) {
    cur = addDays(cur, 1);
    if (!isWeekend(cur)) left--;
  }
  return cur;
}

export function nextBusinessDay(iso: string): string {
  return addBusinessDays(iso, 1);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

export function maxIso(a: string, b: string): string {
  return a > b ? a : b;
}

export function fmt(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = toDate(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) +
    (iso.slice(0, 4) !== TODAY.slice(0, 4) ? ` ${iso.slice(0, 4)}` : "");
}

export function money(v: number | null | undefined): string {
  if (v == null) return "-";
  return v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`;
}

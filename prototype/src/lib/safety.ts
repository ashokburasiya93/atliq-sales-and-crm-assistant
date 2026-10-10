// Draft safety (PRD section 10 and eval "Draft safety"): no other client's names,
// no amounts that are not in this account's own sources, unknown facts left as [blank].
import { companyKey } from "./link";
import type { Account, DraftSafety, ReplyDraft, Source } from "./types";

const AMOUNT = /(\$\s?\d[\d,.]*\s?k?|₹\s?\d[\d,.]*|\b\d+(?:\.\d+)?\s?k\b|\b\d+(?:\.\d+)?\s?(?:lakh|crore)\b|\b(?:USD|INR|Rs\.?)\s?\d[\d,.]*)/gi;

export function checkDraft(d: ReplyDraft, accounts: Account[], sources: Source[]): DraftSafety {
  const own = accounts.find((a) => a.id === d.account);
  const text = d.text.toLowerCase();
  const foreign: string[] = [];
  for (const a of accounts) {
    if (a.id === d.account) continue;
    if (own && companyKey(a.company) === companyKey(own.company)) continue; // duplicate record of the same company
    const key = companyKey(a.company);
    if (key.length >= 4 && new RegExp(`\\b${key}`).test(text)) foreign.push(a.company);
    const contactFirst = a.contact.replace(/^(Dr\.|Mr\.|Ms\.|Prof\.)\s*/i, "").split(/\s+/)[0];
    const ownContact = own?.contact ?? "";
    if (contactFirst && contactFirst.length >= 4 && !/^unsure/i.test(contactFirst) && !ownContact.includes(contactFirst)) {
      if (new RegExp(`\\b${contactFirst.toLowerCase()}\\b`).test(text)) foreign.push(`${a.contact} (${a.company})`);
    }
  }
  const ownText = sources
    .filter((s) => d.sources.includes(s.id))
    .map((s) => s.text.toLowerCase())
    .join("\n");
  const withoutBlanks = d.text.replace(/\[blank:[^\]]*\]/gi, "");
  const unsupported = [...withoutBlanks.matchAll(AMOUNT)]
    .map((m) => m[0].trim())
    .filter((amt) => !ownText.includes(amt.toLowerCase()));
  const blanks = (d.text.match(/\[blank:/gi) ?? []).length;
  return { draftId: d.id, blanks, foreignEntities: [...new Set(foreign)], unsupportedAmounts: unsupported, ok: !foreign.length && !unsupported.length };
}

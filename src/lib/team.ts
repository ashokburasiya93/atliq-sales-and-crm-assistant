import type { Seller } from "./types";

export const SELLERS: Seller[] = ["Bhavin", "Dhaval", "Karandeep", "Jay"];

/** Founders and the CEO see Unassigned items on their brief (PRD FR-7). */
export const SEES_UNASSIGNED: Seller[] = ["Bhavin", "Dhaval", "Karandeep"];

export const TEAM = [
  { name: "Bhavin", role: "Co-founder, lead seller", sells: true },
  { name: "Dhaval", role: "Co-founder, seller", sells: true },
  { name: "Karandeep", role: "CEO, seller", sells: true },
  { name: "Jay", role: "Sales executive", sells: true },
  { name: "Pranav", role: "CTO, pre-sales tasks", sells: false },
  { name: "Ayush", role: "AI Product Manager, pre-sales tasks", sells: false },
];

export function sellerFromSlug(slug: string): Seller | null {
  return SELLERS.find((s) => s.toLowerCase() === slug.toLowerCase()) ?? null;
}

// Reads data/dataset (a copy of the capstone Dataset folder) and writes the pre-processed
// sources and CRM records the app imports. Runs before `dev` and `build`.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, parseSource, toCrm } from "../src/lib/preprocess";

const root = join(process.cwd(), "data", "dataset");
const outDir = join(process.cwd(), "src", "generated");
mkdirSync(outDir, { recursive: true });

const sources = [];
const unreadable: { file: string; reason: string }[] = [];
for (const dir of ["emails", "meeting_notes"]) {
  for (const f of readdirSync(join(root, dir)).filter((x) => x.endsWith(".md")).sort()) {
    try {
      const raw = readFileSync(join(root, dir, f), "utf8").replace(/\r\n/g, "\n");
      sources.push(parseSource(`${dir}/${f}`, raw));
    } catch (e) {
      // Fail safe (PRD FR-1): an unreadable file goes to the Unlinked inbox, never dropped silently.
      unreadable.push({ file: `${dir}/${f}`, reason: String(e) });
    }
  }
}

const crmRaw = readFileSync(join(root, "crm_export.csv"), "utf8").replace(/\r\n/g, "\n");
const crm = toCrm(parseCsv(crmRaw));
writeFileSync(join(outDir, "crm_raw.json"), JSON.stringify({ text: crmRaw }));

writeFileSync(join(outDir, "sources.json"), JSON.stringify(sources, null, 1));
writeFileSync(join(outDir, "crm.json"), JSON.stringify(crm, null, 1));
writeFileSync(join(outDir, "unreadable.json"), JSON.stringify(unreadable, null, 1));
console.log(`build-data: ${sources.length} sources, ${crm.length} CRM records, ${unreadable.length} unreadable`);

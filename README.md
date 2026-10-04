# AtliQ Sales Memory (prototype)

**Live demo:** https://atliq-sales-memory.vercel.app (Vercel Hobby tier, precomputed mode)

Capstone Step 5: a working prototype of the AI PRD *AtliQ Sales Memory*, built over the provided dataset (reference date **Friday 10 July 2026**).

AtliQ does not lack leads; it lacks memory. Client asks, AtliQ promises, deadlines, referrals and revisit dates live in inboxes and meeting scribbles, not in the CRM. This app reads AtliQ's own records, builds a cited ledger of what is owed to whom and by when, gives each seller a ranked morning brief, and proposes CRM updates and reply drafts that a person approves. It never sends anything and never changes the CRM on its own.

## What it does (the PRD's MVP)

| Feature | What you see | Page |
|---|---|---|
| **F1 Capture & Link** | All 50 sources linked to a CRM account by contact email, email domain, lead_id and company name, with a confidence score. Duplicates flagged (Meridian L-1003/L-1027, GlobalMart L-1004/L-1040). Draft leads for companies missing from the CRM (Harbor & Finch, Nimbus Lending, PixelWorks, Lumino Fitness, Ridgeline Foods). Doubtful matches go to Unsure. | Sources, Approvals |
| **F2 Commitment & Signal Ledger** | 68 asks, promises, deadlines, revisits, referrals, cross-sell hints, budget and stakeholder facts. Every row has verbatim source quotes, highlighted in the source. Completions are detected from later sources ("invite sent"). | Ledger, Sources |
| **F3 Daily Brief** | Per seller, capped at 10, ranked by a rule shown on the page (money at risk, then overdue, then coming up). Unassigned items appear on every founder's and the CEO's brief. Plus the pipeline review pack for the founders' meeting. | Daily brief, Review pack |
| **F4 Propose, never act alone** | CRM field updates, next follow-up dates, merges and new leads, each with evidence, approved or rejected with one tap and logged. Reply drafts with `[blank: ...]` for unknown facts, copy only. | Approvals, Accounts, Audit log |

The **Evals** page recomputes the PRD's section 11 launch criteria on every build (link accuracy, citation faithfulness, extraction recall against PRD Appendix A, date accuracy, brief ranking, draft safety, uncertainty handling) and the North Star baseline.

## Models (matches the Step 4 cost estimate)

| Step | Model |
|---|---|
| F1 capture and linking triage | `claude-haiku-4-5-20251001` (rules first; the model only resolves what rules cannot) |
| F2 extraction and CRM proposals | `claude-sonnet-5-5` |
| F3 brief one-liners | `claude-haiku-4-5-20251001` (ranking is plain code) |
| F4 reply drafts | `claude-sonnet-5-5` |

## Two modes

- **Precomputed (default, no key needed).** The model outputs for the dataset are committed in `data/precomputed/` (`capture.json`, `extractions.json`, `crm_proposals.json`, `drafts.json`). They were produced with Claude during the build and are not trusted blindly: on every build, `scripts/verify.mts` re-checks every quote against the cleaned source text and runs the evals, and the build fails if any shown item is uncited or any draft leaks another client's name or an unsupported amount. Owners, due dates, days waiting, overdue status, ranking, follow-up dates and duplicate detection are computed in code (`src/lib/`).
- **Live (when `GROQ_API_KEY` or `ANTHROPIC_API_KEY` is set on the server).** With a Groq key the live features use `openai/gpt-oss-20b` (fast tier: linking, brief lines) and `openai/gpt-oss-120b` (strong tier: extraction, drafts), with strict JSON-schema output; override them with `GROQ_MODEL_FAST` and `GROQ_MODEL_STRONG`. With an Anthropic key they use Haiku 4.5 and Sonnet 5.5 as in the cost estimate. If both are set, Groq wins unless `LLM_PROVIDER=anthropic`. The *Live mode* page links and extracts a pasted email or note, the *Regenerate (live)* button on any reply draft calls Sonnet with only that account's sources, and you can regenerate a seller's brief lines with Haiku. `npm run precompute` re-runs F1 and F2 over the whole dataset and writes the results to `data/precomputed/live-run/` for review.

Keys are read only from the environment. Never paste it into the code or commit it; `.env*` files are git-ignored.

## Run it locally

Requires Node.js 20 or later.

```bash
cd prototype
npm install
npm run dev
```

Open http://localhost:3000. `npm run dev` and `npm run build` first run `scripts/build-data.mts`, which reads `data/dataset/` (a copy of the capstone `Dataset` folder), strips the italic editorial notes, and writes `src/generated/`. `npm run build` also runs `npm run verify`.

To try live mode locally, set the key in your shell before `npm run dev` (PowerShell: `$env:GROQ_API_KEY="..."`; bash: `export GROQ_API_KEY=...`).

## Deploy to Vercel (free Hobby tier)

```bash
cd prototype
npx vercel login
npx vercel deploy --prod
```

Accept the defaults (framework: Next.js, root: this folder). No database or paid add-on is needed. For live mode, add `GROQ_API_KEY` (or `ANTHROPIC_API_KEY`) under the project's Settings > Environment Variables and redeploy; without it the deployed demo runs on the precomputed outputs.

Seller decisions (approvals, done/snooze, assignments, the audit log) are stored in the viewer's browser, because the prototype has no database. Approved CRM changes download as `approved_crm_changes.csv`, the PRD's fallback change file until CRM write-back exists. The "Acting as" selector stands in for sign-in.

## Guardrails it enforces

Also listed in the app under *Guardrails*, with the file that enforces each.

1. **Never sends anything to a client.** No send code path; drafts are copy only.
2. **Never writes to or merges CRM records without a seller's approval.** Every change is a proposal with evidence; decisions are logged with who and when; duplicates are flagged, never merged.
3. **No quote, no item.** Every ledger row, completion, proposal and draft lead quotes its source verbatim, checked at build time and at runtime.
4. **Never invents prices, dates, scope or commitments.** Unknowns are `[blank: ...]`; a safety check rejects amounts not in the account's own sources.
5. **Does not answer security questionnaires or write SOWs, proposals, pricing or contract terms.** These are routed as tasks with an owner and due date; the draft API refuses them.
6. **No cross-client leakage.** Drafts use one account's sources; the safety check fails any draft naming another account.
7. **Uncertainty is visible, owners are never guessed.** Below-threshold links, "L-1002?" and "Prakash? Prashant?" go to Unsure with options; unowned items show as Unassigned with a proposed owner.
8. **Reads only AtliQ's own records.** No web scraping, enrichment, lead scoring or win probability.
9. **The dataset's editorial notes never reach a model.** They are stripped in pre-processing and used only as eval ground truth.
10. **Alert fatigue control.** Brief capped at 10 with snooze and dismiss.
11. **Fail safe.** Unreadable or unmatched files go to the Unlinked inbox; without a key the app serves verified precomputed outputs.

## Known limits and choices

- The North Star on the Evals and Review pack pages is computed only from what the sources show (editorial notes stripped), so it differs a little from the hand-labelled 41% in PRD Appendix A. For example, the DataNest call on 8 Jul has no source recording its outcome, so it stays open.
- LoopMart's pricing ask is dated from the TechSummit debrief (14 Jun) rather than the 26 Jun call, so its due date differs from the Appendix label; it shows as a miss in the date-accuracy eval.
- Unassigned items are listed below the 10-item cap rather than counted inside it.
- The dataset was not extended.

## Project layout

```
data/dataset/          copy of the capstone Dataset folder (input)
data/precomputed/      committed model outputs (F1, F2, F4)
data/eval/             link truth for the 50 files and PRD Appendix A labels
scripts/               build-data, verify (guardrail checks and evals), precompute (live re-run)
src/lib/               preprocess, link, ledger, brief, proposals, safety, evals, llm
src/app/               pages and the live-mode API routes
```

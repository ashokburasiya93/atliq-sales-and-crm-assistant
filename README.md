# AtliQ Sales and CRM Assistant

AI Product Management capstone. AtliQ does not lack leads; it lacks memory. Client asks, promises, deadlines, referrals and revisit dates live in inboxes and meeting notes instead of the CRM. The AtliQ Sales and CRM Assistant reads those records, builds a cited ledger of what is owed to whom and by when, gives each seller a ranked daily brief, and proposes CRM updates and reply drafts that a person approves. It never sends anything or changes the CRM on its own.

- **Live prototype:** https://atliq-sales-and-crm-assistant.vercel.app
- **Demo video (about 5 min):** https://www.loom.com/share/cad82b3eae044d318e691b96f9838eaf
- **AI opportunity map (Miro):** https://miro.com/app/board/uXjVEfaAWpg=/

## Deliverables

| # | Deliverable | Format | Where |
|---|---|---|---|
| 1 | Completed user research worksheet | Excel | [3. Problem Discovery Template - AtliQ (Completed).xlsx](<3. Problem Discovery Template - AtliQ (Completed).xlsx>) |
| 2 | AI opportunity map | Miro board link | [Miro board](https://miro.com/app/board/uXjVEfaAWpg=/), with a written copy in [4. AI Opportunity Mapping - AtliQ (Miro Board Content).docx](<4. AI Opportunity Mapping - AtliQ (Miro Board Content).docx>) and the [CSV import](<4. AI Opportunity Mapping - AtliQ (Miro Import).csv>) |
| 3 | AI PRD (with North Star & Metrics) | Word | [5. AI PRD - AtliQ Sales and CRM Assistant (Completed).docx](<5. AI PRD - AtliQ Sales and CRM Assistant (Completed).docx>) |
| 4 | Cost estimation | Excel | [6. Cost Estimation - AtliQ Sales and CRM Assistant (Completed).xlsx](<6. Cost Estimation - AtliQ Sales and CRM Assistant (Completed).xlsx>) |
| 5 | Working AI prototype | Code + README | [prototype/](prototype/) and its [README](prototype/README.md) |
| 6 | Presentation | PowerPoint | [7. Presentation - AtliQ Sales and CRM Assistant.pptx](<7. Presentation - AtliQ Sales and CRM Assistant.pptx>) |
| 7 | Stakeholder demo video | Video link | [Loom](https://www.loom.com/share/cad82b3eae044d318e691b96f9838eaf) |

GitHub does not preview Word, Excel or PowerPoint files in the browser. Use the **Download raw file** button on each file's page to open it.

## Running the prototype

The prototype is a Next.js app that works over the provided synthetic dataset (in `prototype/data/dataset`). It runs without any API key on precomputed, verified outputs; a Groq or Anthropic key turns on live mode. See [prototype/README.md](prototype/README.md) for setup, the tech stack and the evals.

```bash
cd prototype
npm install
npm run dev
```

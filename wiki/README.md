# wiki/

Prose articles that tie together what the graph only shows as edges. One article per high-value concept or flow.

Inspired by Andrej Karpathy's LLM Wiki pattern: the graph is the map, these articles are the travel guide. The graph shows *what connects to what*; the wiki explains *why* and *what matters*.

## What belongs here

- **End-to-end flows** — "Transaction Flow" (frontend form → API → service → DB → invoice)
- **Cross-cutting concerns** — "Permission System", "Authentication"
- **Architectural decisions with trade-offs** — "Why two JWT modules exist", "Pool vs Stock"
- **Onboarding primers** — "Inventory data model", "Blend template lifecycle"

## What doesn't belong

- Per-file or per-function notes — those live in `graphify-out/obsidian/` (auto-generated).
- Code documentation — put it in docstrings or JSDoc.
- Transient debugging notes — put those in `raw/`.

## Format

Each article:
1. Starts with a 2–3 sentence TL;DR
2. Uses Obsidian-style `[[links]]` to node notes in `graphify-out/obsidian/` so you can jump to code
3. Ends with a "Gotchas" or "Open questions" section for institutional knowledge that would otherwise be lost

## Who writes these

Either you or Claude. When you ask an architecture question and the answer is non-trivial, paste it here as a new article — that's the Karpathy pattern: every good answer becomes a persistent document.

## Current articles

- [[transaction-flow|Transaction Flow]] — end-to-end path from POS screen to PDF invoice
- [[controller-conventions|Controller Conventions & Common Gotchas]] — delete-guard field drift, `statusCode` vs `status`, sparse-vs-partial unique indexes
- [[patient-medical-photos|Patient Medical Photos]] — upload/view/delete medical images attached to a patient; Wasabi-backed
- [[storage-abstraction|Storage Abstraction (Wasabi / S3)]] — the `StorageDriver` pattern: Wasabi in prod, in-memory in tests
- [[blend-infrastructure|Blend Infrastructure]] — fixed blends, custom blends, shared validator; stress test + audit of three critical wiring bugs
- [[deduction-surfaces|Deduction & Mutation Surfaces]] — refund / restock / pool-transfer / bundle / credit audit; 7 bugs fixed, 1 design gap (credit balance)
- [[crm-issues-2026-monitoring|CRM Issues 2026 — monitoring board]] — client feedback tracker; 22 closed, 1 ops follow-up, 4 awaiting repro (as of 2026-04-24)

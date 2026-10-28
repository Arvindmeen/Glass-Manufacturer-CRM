# Delivery plan — 5 phases

Brief: [Trial_Task_CRM_Prototype_for_a_Glass_Manufacturer.pdf](./Trial_Task_CRM_Prototype_for_a_Glass_Manufacturer.pdf). Deadline: Tue, Nov 3, 2026. Budget: ~10 h.

Guiding rule for every screen: show only what a sales rep on the road needs. No explanatory copy, no decorative text, few clicks, one-handed on a phone.

## Phase 1 — Foundation
- Vite + React + TypeScript, React Router.
- Browser-only data store (localStorage) with typed entities: companies, people (many-to-many), meetings, tasks, knowledge entries, emails.
- Realistic seed data: ~15 companies, ~25 people, meetings, tasks.
- i18n DE / EN, switchable.
- Responsive shell: bottom nav on phone, sidebar on desktop; floating voice button everywhere.
- Settings: OpenAI key (stored in browser only), language, reset demo data.

## Phase 2 — Core workflow: contacts, meetings, tasks
- Companies and people: list + search, detail, create/edit, link/unlink, notes.
- Meetings on company/person pages: date, participants, summary; fill a meeting by voice.
- Tasks board: Planned / In progress / Done; linked to company/person and shown on their pages.

## Phase 3 — Central voice command
- Record → Done → transcribe (OpenAI) → interpret into proposed actions (create company/person/meeting/task, add notes).
- Match existing records (no duplicate "Schreinerei Huber"); link new items to each other.
- Review list: accept / edit / reject per proposal, then save all accepted.

## Phase 4 — Remaining modules
- Knowledge base: sections, product search, step-by-step installation tutorials, voice-to-entry with review, AI chat using CRM + knowledge as context.
- Email inbox mockup: quote requests → extract (customer, products, quantities, dimensions) → confirm → "Transfer to ERP" (simulated).
- Companies map + route planning: select companies → order stops (nearest neighbour + 2-opt) → open in Google Maps.
- Lead search mockup with static results.
- Empty "simap Bot" tab.

## Phase 5 — Polish and hand-in
- Mobile pass, DE/EN completeness, empty/error states.
- README: run, what was built, what was left out, route ordering.
- Architecture plan (Part 2) in Markdown with Mermaid diagrams.
- Vercel deploy config; screen recording (done by you).

## Open questions for the client
- Map tiles: is OpenStreetMap allowed for the map view, or only Google Maps links? (Prototype default: an offline map drawn from coordinates, no extra service.)
- ERP name for the "Transfer to …" button.
- Primary language of reps (default UI language).

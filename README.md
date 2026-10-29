# Glass CRM — prototype for a glass manufacturer

A clickable CRM for sales reps and technicians of a Swiss glass manufacturer. React + TypeScript, **no backend**: all data lives in the browser. The only external services called are the OpenAI API and Google Maps links.

- **Live:** https://glass-manufacturer-crm.vercel.app (desktop and phone)
- **Brief:** [docs/Trial_Task_CRM_Prototype_for_a_Glass_Manufacturer.pdf](docs/Trial_Task_CRM_Prototype_for_a_Glass_Manufacturer.pdf)
- **Architecture plan (Part 2) and full project documentation:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Test scripts:** [docs/TEST_SCRIPTS.md](docs/TEST_SCRIPTS.md) · [docs/VOICE_TEST_SCRIPTS.md](docs/VOICE_TEST_SCRIPTS.md)

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type check + production build (fails if anything key-shaped is found)
npm run preview    # serve the build with the same security headers as Vercel
npm run lint
```

Open **Settings** and paste an OpenAI API key. It is encrypted in the browser and never stored in the repository. Everything except the AI features works without a key. **Settings → Reset demo data** restores the sample data (15 companies, 25 people, 10 meetings, 12 tasks, 7 knowledge entries, 7 emails).

Deploy: import the repo in Vercel (framework preset Vite). `vercel.json` adds the SPA rewrite and the security headers (CSP, HSTS, no framing).

## What was built

| Area | What the user can do |
|---|---|
| **Contacts** | Companies and people, many-to-many. Standard fields plus free notes. Each has its meetings and tasks. Search on every list. |
| **Central voice command** | One mic, available everywhere (bottom bar on phones, "Speak" in the sidebar on desktop). Speak freely, press Done. The audio is transcribed, then interpreted into proposals: company, person, meeting, task, note, task update or delete, contact update, person-to-company link, knowledge entry. Each proposal can be accepted, edited or rejected; then all accepted ones are saved. It also answers questions, opens pages and plans routes. |
| **No duplicates** | Existing records are recognised, even with typos or without "AG"/"GmbH" (no second Schreinerei Huber). New items are linked to existing or newly proposed records. Anything already in the CRM is shown as existing, not created again. A repeated item with new details (e.g. the person's name) updates the existing one. |
| **Meetings by voice** | On a company or person page, the same mic knows which record is open, so "we discussed …" becomes a meeting linked to it. |
| **Tasks** | Board with Planned / In progress / Done (tabs on phones, drag and drop on desktop). Linked to a company and/or person and shown on their pages. Created by hand or by voice. |
| **Knowledge base** | Sections Installations, Products, Troubleshooting, Sales. Product search. Step-by-step tutorials with images (placeholders or uploaded photos). Voice know-how becomes a structured entry, reviewed before saving. |
| **Ask (AI chat)** | Next to every "+" button. Answers any work question using CRM data and the knowledge base. For a partial or misspelled name it first asks "which one do you mean?" and lists names only. |
| **Inbox (mockup)** | Sample emails; quote requests are marked. *Extract request* proposes customer, contact, products, quantities and dimensions (missing values are flagged, never invented). After confirming: **Transfer to Safir** (the client's ERP, simulated). |
| **Map and route** | Companies on Google Maps. Select stops → **Plan route** → efficient order → **Open in Google Maps**, ready for navigation. |
| **Lead search (mockup)** | Region, business type and filters → a believable result list "from the commercial register, websites checked". Static data. |
| **simap Bot** | Empty tab, as requested. |
| **German / English** | Whole UI, all demo data and the user's own entries switch language (own entries via AI translation, remembered both ways). The default follows the browser (German → DE, otherwise EN). |

## How the route ordering works

`src/lib/route.ts`. It optimises an **open path**: the rep does not have to return to the start.

1. **Coordinates.** Every company has latitude/longitude (seed data, or an offline table of Swiss towns for new records). Distances are straight-line (haversine) in a distance matrix.
2. **Start.** If the phone's position is within 150 km of a stop, the route starts there. Otherwise the planner tries every stop as the first one and keeps the shortest result.
3. **Construction.** Nearest neighbour: always drive to the closest stop not yet visited.
4. **Improvement**, repeated until nothing gets shorter:
   - **2-opt:** reverse a segment when that removes a crossing.
   - **Or-opt:** move a run of 1–3 stops, either way round, to a better place.

   For up to ~10 stops this reaches the optimum in practice: identical to brute force in 30 random 8-stop tests. 30 stops take about 0.1 s on a laptop.
5. **Google Maps.** The ordered stops are sent as exact coordinates in one directions link: origin, up to 9 waypoints, destination. Longer routes are split into parts of up to 11 points, each starting where the last one ended ("Open in Google Maps 1/2"). The keyless map preview can only draw one drive at a time, so chips switch between the drives ("1 → 2", "2 → 3", …).

Limits: straight-line distance, not road distance or traffic. In production the server would refine the order with Google's route optimisation; see the architecture plan.

## What was left out, and why

| Left out | Why |
|---|---|
| Any backend, accounts, sync between devices | Forbidden by the brief. Data stays in one browser; see Part 2 for the real system. |
| Real email, ERP, commercial-register and simap connections | Mockups by design. Part 2 describes how they connect. |
| Road distances and traffic in route planning | Would need a paid Google API with a server-side key. Straight-line order plus Google's own navigation is good enough for a day's visits. |
| Geocoding of new addresses | Needs a key and a server. New companies get town coordinates from an offline table instead. |
| Offline voice (record without network, send later) | The phone needs a connection for the AI calls. |
| Automated test suite in the repo | Behaviour was tested with Playwright scripts during development and the manual scripts in `docs/`; a CI suite would be the next step. |
| Hard protection of the OpenAI key | Impossible without a server. The key is encrypted (AES-GCM, non-extractable key), only sent to `api.openai.com` and never shown, but code running in the open app can still use it. Part 2 moves the key to the server. |

## Project structure

```
src/
  pages/        one file per screen (Companies, Company, People, Person, Tasks, Inbox, Knowledge, Leads, simap, Settings)
  components/   Layout, VoiceCommand (central assistant), AskChat, forms, pickers, sheets
  lib/          interpret (voice → proposals, duplicate check), assistant (chat), openai, guard (AI guard rails),
                keyVault (encrypted key), route (ordering), geo (coordinates, Google Maps embeds), translateData
  store/        db (IndexedDB + localStorage, cross-tab sync), seed (EN/DE demo data), settings
  i18n/         en.ts, de.ts
docs/           brief, plan, architecture, test scripts
```

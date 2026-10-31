# Delivery plan — 5 phases

Brief: [Trial_Task_CRM_Prototype_for_a_Glass_Manufacturer.pdf](./Trial_Task_CRM_Prototype_for_a_Glass_Manufacturer.pdf). Deadline: Tue, Nov 3, 2026. Budget: ~10 h.

Guiding rule for every screen: show only what a sales rep on the road needs. No explanatory copy, no decorative text, few clicks, one-handed on a phone.

## Phase 1 — Foundation ✅
- Vite + React 19 + TypeScript, React Router.
- Dual browser storage: IndexedDB (full dataset + photos) + localStorage (fast synchronous snapshot) with revision tracking and BroadcastChannel cross-tab synchronization.
- Realistic seed data: 15 companies, 25 people (many-to-many), 10 meetings, 12 tasks, 7 knowledge entries, 7 emails.
- i18n DE / EN, switchable in UI with automatic browser language detection.
- Responsive shell: bottom navigation on mobile, sidebar on desktop; floating voice assistant available on every page.
- Settings: OpenAI key vault (AES-256-GCM encrypted in browser), language switcher, reset demo data.
- Site Access Gate (`PasswordGate`): Class-encapsulated gate protecting public prototype with 7-hour session, User-Agent binding, brute-force rate limiter, and anti-inspection hardening.

## Phase 2 — Core workflow: contacts, meetings, tasks ✅
- Companies and people: list + search, detail views, create/edit, link/unlink, notes.
- Many-to-many person ↔ company relationships with individual roles and primary contact markers.
- Meetings on company/person pages: date, participants, summary; contextual voice creation knowing the open record.
- Tasks board: Planned / In progress / Done columns; linked to company and/or person; status transitions and drag-and-drop.

## Phase 3 — Central voice command ✅
- Record → Done → transcribe (OpenAI Whisper) → interpret (GPT model) into proposed actions:
  - 12 action types: create company/person/meeting/task, update/delete task, add notes, update contact details, link person to company, create knowledge entry.
- Match existing records with fuzzy duplicate detection (no duplicate "Schreinerei Huber"); link new items to each other.
- Review list: accept ✓, edit ✏, or reject ✕ per proposal, then atomic multi-entity commit.
- Non-confirmation voice actions: instant CRM navigation, route planning, free-form CRM Q&A, quote extraction, language switching.

## Phase 4 — Remaining modules ✅
- Knowledge base: 4 sections (Installations, Products, Troubleshooting, Sales), product search, step-by-step tutorials with images/camera photos, voice-to-entry dictation with review, AI chat ("Ask") using CRM + knowledge as context.
- Email inbox mockup: quote requests → extract (customer, contact, products, quantities, dimensions; missing values flagged, never invented) → confirm → "Transfer to Safir" (simulated ERP handoff).
- Companies map + route planning: select stops → open-path optimization (nearest-neighbour + 2-opt + Or-opt) → directions link in Google Maps (split into 11-stop chunks).
- Lead search mockup with realistic Canton Bern commercial register entries and website verification chips.
- Empty "simap Bot" tab as specified in the brief.

## Phase 5 — Polish and hand-in ✅
- Mobile pass: touch targets ≥ 44px, bottom sheets with drag-to-dismiss gestures, bottom navigation, one-handed reachability.
- DE / EN completeness: UI dictionaries, demo data, AI translation of user-created entries, and language-preserving voice assistant responses.
- Security hardening:
  - Site password gate with ECMAScript `#` private field encapsulation, 7-hour session expiry, browser-specific User-Agent signature, brute-force lockout, timing attack mitigation, and DOM inspect protection.
  - Browser-side OpenAI key vault with AES-256-GCM under a non-extractable WebCrypto key.
  - 4-layer AI guard rails (input check, prompt rules with canary, output check, 20/min rate limiter).
  - Vercel Content Security Policy (CSP), HSTS, anti-framing, strict permissions.
  - Secret scanner script (`scripts/check-secrets.mjs`) in pre-build and Git pre-commit hooks.
- Documentation:
  - Full README with complete feature documentation, security architecture, and route algorithm details. [README.md](../README.md)
  - Part 2 architecture plan with Mermaid diagrams covering modular monolith, multi-tenancy RLS, passwordless auth, database schema, and cost modeling. [ARCHITECTURE.md](./ARCHITECTURE.md)
  - End-to-end test walkthroughs for 5 realistic user personas. [TEST_SCRIPTS.md](./TEST_SCRIPTS.md)
  - 25 dedicated voice command test scenarios. [VOICE_TEST_SCRIPTS.md](./VOICE_TEST_SCRIPTS.md)

## Key Technical Decisions

1. **Dual Storage Layer (`src/store/db.ts`)**
   - IndexedDB handles large quotas (including uploaded tutorial photos).
   - localStorage maintains a fast synchronous snapshot for instant first renders.
   - BroadcastChannel ensures active tabs synchronize immediately without stale writes.

2. **Site Password Gate (`src/components/PasswordGate.tsx`)**
   - Enforces a 7-hour work session on client-side access to protect the public Vercel deployment.
   - Encapsulated inside `GateSecurityEngine` using native ECMAScript `#` private fields—inaccessible to external scripts or DevTools console.
   - Bound to `navigator.userAgent` to prevent token cloning across browsers or devices.
   - Anti-brute-force rate limiting: 5 consecutive failures triggers a 30-second lockout with a live countdown timer.
   - DOM inspection protection: CSS disc masking (`-webkit-text-security`), DevTools shortcuts blocked (`F12`, `Ctrl+Shift+I/J/C`, `Ctrl+U`), context menu disabled, clipboard copy/cut disabled, password manager extensions ignored.
   - Built-in eye toggle for show/hide password, and automatic browser language detection (German vs English) with on-screen toggle.
   - Plaintext password is never in the codebase; only its SHA-256 hash is verified.

3. **OpenAI Key Vault (`src/lib/keyVault.ts`)**
   - Encrypted at rest using AES-256-GCM with a non-extractable WebCrypto key in IndexedDB (raw key bytes cannot be extracted).
   - In memory, decrypted only momentarily inside `vaultFetch` to attach the `Authorization` header, then immediately dropped.
   - Pre-warms CORS preflight OPTIONS connections during active voice recording to reduce latency.

4. **AI Guard Rails (`src/lib/guard.ts`)**
   - Input filter blocks prompt injections, secret fishing, and bulk contact harvesting before network dispatch.
   - Prompts wrap CRM data in `<crm_data>` delimiters and enforce a random per-session canary token.
   - Output filter checks for canary leaks, key patterns, HTML/script tags, and caps returned contacts to 3 records.
   - Sliding-window rate limit capped at 20 requests per minute.

5. **Route Planning (`src/lib/route.ts`)**
   - Open-path traveling salesperson optimization: Haversine distance matrix + nearest-neighbour initialization + 2-opt edge untangling + Or-opt segment relocation.
   - Exports directly to Google Maps navigation URLs, chunked at 11 stops to fit navigation constraints.

# Frontend production-readiness audit

| | |
|---|---|
| **Scope** | Frontend, GitHub repository, security, code quality, reliability, production readiness of the Glass CRM prototype |
| **Reference** | Trial Task: CRM Prototype for a Glass Manufacturer (PDF in `docs/`) |
| **Audited commit** | `aed130f` → fixes in `2d01ae9` (branch `claude/upbeat-goldberg-wmihd0`) |
| **Date** | 29 October 2026 |
| **Method** | Source review, Git history scan, `npm audit`, TypeScript, oxlint, production build; Playwright (Chromium) against the production build (`vite preview`) with **OpenAI and Google Maps mocked**; axe-core 4.10 for accessibility; new Vitest unit tests |

## Final decision

> **READY WITH CONDITIONS** — for public release **as the trial prototype with demo data**.

Conditions:

1. Use an OpenAI key **created for this demo only**, with a low monthly spending limit on the OpenAI side, and revoke it after the review (see R-1).
2. Do not enter real customer data in the public deployment (see R-2).
3. Confirm the security headers on the live Vercel URL (CI is green; the live URL could not be reached from the test sandbox, see "Not tested").

It is **NOT READY** for real customer use with real data. That needs the backend from the architecture plan (login, server-side key, encrypted server-side storage). This is not a defect of the prototype: the brief forbids a backend, and no browser-only app can protect a key or data from someone who controls the browser.

---

## 1. Summary

| | Count | Status |
|---|---|---|
| Critical | 0 | — |
| High | 1 | Fixed |
| Medium | 5 | Fixed |
| Low | 4 | Fixed |
| Informational / accepted risks | 9 | Documented, with recommendations |

| Check | Result |
|---|---|
| Secrets in tracked files and full Git history | **None found** (§3) |
| `npm audit` | **0 vulnerabilities** (before and after adding test tools) |
| TypeScript (`tsc -b`, strict) | **0 errors** |
| Lint (oxlint) | **0 errors**, 12 warnings (all reviewed, §6) |
| Production build | OK, no source maps, secret scan of the bundle clean |
| Unit tests (new, Vitest) | **46 / 46 passed** |
| Browser security suite (new) | **22 / 22 passed** |
| Browser feature, layout and accessibility suite (new) | **36 / 36 passed** |
| Accessibility (axe, WCAG 2.1 A/AA, 26 screens + 6 open sheets) | **0 violations** after fixes (32 serious before) |
| Horizontal overflow, 320–1920 px, pages and open sheets | **None** after fixes (3 before) |

---

## 2. Findings

Severity is impact × likelihood for a public demo. All "Fixed" items were reproduced first, then re-tested after the fix.

### Fixed

| ID | Severity | Finding | Affected files | Evidence (before) | Fix | Verified by |
|---|---|---|---|---|---|---|
| H-1 | **High** (total outage, low likelihood) | A stored record with missing or wrong-typed fields crashes **every page** with a blank screen. The bad data persists, so reloading does not help, and the user cannot recover without clearing site data. Triggers: an older data format, an interrupted write, a browser extension, manual edits. | `src/store/db.ts` (`normalizeDB` only checked that collections are arrays) | 9/9 pages threw, e.g. `Cannot read properties of undefined (reading 'localeCompare')` on `/companies`, `e.tags.join is not a function` on `/knowledge` | New `src/store/validate.ts`: every record is coerced to its type with safe defaults; records without an id or with duplicate ids are dropped. Used for localStorage, IndexedDB and cross-tab messages | `SEC-18` ×3 (invalid JSON, wrong fields, dangerous photo URLs): 9/9 pages render. `validate.test.ts` (4 tests) |
| M-1 | **Medium** (privacy, cost) | The user's own entries were sent to OpenAI for translation on **every page load**, without any user action. A failed translation was retried on every load. | `src/components/Layout.tsx` | 3 page loads → 3 translation requests | Translation only runs when the user switches the language | Isolated test: 3 page loads → **0** AI requests; `SEC-08…13` now confirm zero requests |
| M-2 | **Medium** | No error boundary: any render error left a blank page with no way out | `src/main.tsx` | Code review; forced render error → blank | `src/components/ErrorBoundary.tsx`: message + **Reload** + **Reset demo data** (with confirmation), EN/DE | Forced render error (date formatting made to throw) → recovery screen shown |
| M-3 | **Medium** (core usability) | The on-device misuse filter refused normal glazing questions: "crack" (a cracked pane), "bypass" (the old frame), and scoped requests like "Show all contacts at Schreinerei Huber" | `src/lib/guard.ts` | Probe: `blocked` for "How do I bypass the old frame when mounting?", "Show all contacts at Schreinerei Huber"; same rule matched "crack" | "crack"/"bypass" are blocked only next to security terms (password, login, filter…). Bulk contact requests are allowed when scoped to a named company or person; the output guard still caps answers at 3 records | `guard.test.ts`: 12 misuse phrases refused, 10 normal phrases allowed; `SEC-08…13` still refused |
| M-4 | **Medium** (accessibility) | Colour contrast below WCAG AA (32 elements): orange "Speak" button 3.68:1, "Quote request" chip 3.25:1, overdue chip 4.47:1. Done-task icon had a prohibited `aria-label` on a plain `span` | `src/index.css`, `src/components/related.tsx` | axe: `color-contrast` ×32 (serious), `aria-prohibited-attr` ×4 (serious) | `--accent-strong` for orange buttons and text that carry text (icon-only phone mic unchanged); darker `--warn`, `--danger`, `--ok`; `role="img"` on the done icon | axe: **0 violations** on 32 screens (phone + desktop + open sheets) |
| M-5 | **Medium** (found after the audit) | Manager overviews such as "Show all meetings scheduled for November 2026" were refused in chat and voice. The output guard counted ISO dates (`2026-11-03`) as phone numbers, so any answer with more than 3 dates was blocked as a "bulk contact" leak | `src/lib/guard.ts`, prompts in `src/lib/assistant.ts`, `src/lib/interpret.ts` | `checkOutput` on a 4-meeting list → blocked | Phone detection requires a leading + or 0 and 9–15 digits; dates, quantities and IDs no longer count. Both prompts explicitly cover overviews, counts and date ranges | `guard.test.ts` (date lists shown, 4 phone numbers still blocked); e2e `F-33` chat and `F-34` voice |
| L-1 | Low | At 320–360 px, Settings and Lead search were wider than the screen and scrolled sideways | `src/index.css` | Settings +71 px at 320 px, +31 px at 360 px; Lead search +18 px | Grid and flex children may shrink (`minmax(0,1fr)`, `min-width:0`); key-storage buttons and saved-key row wrap | `F-29` at 320, 360, 390, 768, 1280, 1920 px; all forms, assistant, chat and review sheets at 320 and 360 px |
| L-2 | Low | AI failures showed raw technical text: `Unexpected token 'h', "this is not json"…`, `Failed to fetch`, provider messages | `src/lib/aiError.ts`, `src/lib/openai.ts` | `F-14…17` before the fix | Errors mapped to clear EN/DE messages: key not accepted (401/403), limit (429), service unavailable (5xx), offline, unreadable answer | `F-14…17`, `SEC-15` |
| L-3 | Low (process) | No automated tests and no CI in the repository | — | `git ls-files`, no `.github/` | 46 Vitest unit tests; two Playwright suites in `tests/e2e/`; `.github/workflows/ci.yml` (secret scan, type check, lint, tests, build, `npm audit --audit-level=high`) | `npm test`; CI run on GitHub |
| L-4 | Low | Secret scanner only knew OpenAI, Google and private-key patterns | `scripts/check-secrets.mjs` | Code review | Added GitHub, AWS and Slack token patterns | Scanner then blocked a commit containing a fake test key (correct behaviour), which was changed to be assembled at runtime |

### Accepted risks and informational findings (not fixed)

| ID | Severity | Finding | Why not fixed / recommendation |
|---|---|---|---|
| R-1 | **High (inherent)** | The OpenAI key can be **used** by any code running in the open app. Someone with the device, or with the developer tools, can pause the code and read it during a request. | Impossible to solve without a server; the brief forbids one. The key is already protected as far as a browser allows, verified by `SEC-01`, `SEC-02`, `SEC-16`, `SEC-17`, `F-03`: encrypted at rest and in memory, sent only to `api.openai.com`, never shown, not in DOM/storage/logs, and the CSP blocks foreign scripts. **Recommendation:** a dedicated demo key with a spend limit, revoked after review; production moves the key to the server (architecture plan B7.2). |
| R-2 | **Medium (inherent)** | CRM data is stored **unencrypted** in localStorage/IndexedDB. Anyone with access to the browser profile can read it. There are no logins or roles. | Required by the brief (data lives in the browser). Fine for demo data. **Recommendation:** no real customer data in the public demo. |
| R-3 | Low | The on-device misuse filter is pattern-based and can be bypassed by paraphrasing. | It is the first layer only. The others are verified: security rules in every prompt, data minimisation, the `<crm_data>` boundary, and output checks blocking scripts, keys and more than 3 emails/phones (`SEC-07a`, `SEC-14`). Production enforces the same on the server. |
| R-4 | Low | CSP allows `style-src 'unsafe-inline'` | Needed for React inline styles. Scripts are strictly `'self'` with Trusted Types, so the risk is low. |
| R-5 | Info | A website value like `javascript:…` becomes `https://javascript:…`, a harmless but odd link | Always forced to `https://` (`SEC-04`), so no script can run. Optional: validate the website field. |
| R-6 | Info | `mailto:` / `tel:` links are built from the record without URL-encoding | Only the user's own data can prefill their own mail app; there is no cross-user impact. Optional: `encodeURIComponent`. |
| R-7 | Info | 12 lint warnings | 10 are React fast-refresh hints (files export helpers next to components). 2 are false positives: `performance.now` inside a pointer handler (`ui.tsx:165`), and a deliberate safety stop of long recordings (`VoiceRecorder.tsx:89`). |
| R-8 | Info | One JS bundle of 462 kB (145 kB gzip) | Acceptable for a prototype; code splitting per page is optional. |
| R-9 | Info | The data cleaner runs on every cross-tab message | Negligible at this data size; noted for a much larger dataset. |

---

## 3. GitHub and secret scan

| Check | Command / method | Result |
|---|---|---|
| Full history, all branches, all commits (48) | `git log --all -p` searched for OpenAI (`sk-…`, `sk-proj-…`), Google (`AIza…`), GitHub (`ghp_…`, `github_pat_…`), Slack (`xox…`), AWS (`AKIA…`), JWTs, private keys | **No matches** |
| Files ever committed | `git log --all --name-only` for `.env*`, `*.pem`, `*.key`, `credentials`, `secret` | Only `scripts/check-secrets.mjs` (the scanner itself) — **no secret files** |
| Password/token assignments in tracked files | `git grep` for `password|api_key|secret|token = "…"` | **None** |
| `.gitignore` | Review | Ignores `.env`, `.env.*`, `*.pem`, `*.key`, `node_modules`, `dist`, test results |
| Production bundle (`dist/`) | Secret patterns, `localhost`, source maps | **Clean**, no source maps, no `console.*` from app code (4 occurrences come from React/library code) |
| Pre-commit hook | `.githooks/pre-commit` → `check-secrets --staged` | Works: it blocked a commit containing a **fake** test key during this audit |
| GitHub Actions | Before: none. Now: `.github/workflows/ci.yml` with `permissions: contents: read` | First run **passed** (§7) |
| Commit metadata | `git log --format='%an <%ae>'` | 47 commits by the Claude bot address, 1 by the repository owner (owner's own address, expected) |
| Environment variables | `import.meta.env` / `process.env` in `src/` | **None used**; the key is entered at runtime in Settings |

No secret was found, so nothing needed redacting. Test keys used during the audit were fake (`sk-proj-AUDI…`), mocked, and assembled at runtime in the test files.

---

## 4. Brief (PDF) requirements

| Requirement | Verified | Evidence |
|---|---|---|
| React + TypeScript | ✅ | `package.json` (React 19, TypeScript 7), `tsc -b` strict passes |
| All prototype data in browser storage | ✅ | `src/store/db.ts`: IndexedDB + localStorage; `F-04`, `F-06`, `F-22` persist after reload |
| No backend, server, database, Supabase or Firebase | ✅ | No such dependencies; no `api/`, `server/` or `functions/` folders; `vercel.json` only rewrites to `index.html` |
| Only OpenAI API and Google Maps called | ✅ | One network call site in `src/` (`vaultFetch`, origin-checked); CSP `connect-src 'self' https://api.openai.com`, `frame-src` Google Maps only; `SEC-17`: only the app, OpenAI and Google origins contacted |
| Works on mobile and desktop | ✅ | `F-29` (320–1920 px), open sheets at 320/360 px, phone and desktop runs of both suites |
| Voice workflow proposes actions and needs approval before saving | ✅ | `F-10` (Save disabled until a decision), `F-11`/`F-12` (accept, edit, reject), unit test "every proposal starts undecided" |
| Recognise existing records, link new items | ✅ | `F-09`, `F-11`, `F-13`; unit tests for `findCompany`, `resolve` |
| Lead search and inbox remain mockups | ✅ | `F-25` (static results, no external request), inbox uses sample emails, Safir transfer simulated (`F-22`) |
| Readable, not over-engineered code | ✅ | One React app, small `lib/` modules, no state library; 4 runtime dependencies |

---

## 5. Features tested and results

All browser tests run against the **production build** with Chromium, OpenAI and Google Maps **mocked**. Each test name below is the ID printed by `npm run test:e2e`.

### Security (`tests/e2e/security.cjs`) — 22 / 22

| ID | What was attacked or checked | Result |
|---|---|---|
| SEC-01 | Key not in DOM, inputs, localStorage, sessionStorage | ✅ |
| SEC-02 | Key not readable in IndexedDB (encrypted) | ✅ |
| SEC-03 | `<img onerror>` / `<script>` in company fields | ✅ rendered as text |
| SEC-04 | `javascript:` website | ✅ forced to `https://` |
| SEC-05 | XSS payload in lists and search | ✅ |
| SEC-06 | HTML and markdown `javascript:` links in AI chat answers | ✅ plain text |
| SEC-07a | AI reply containing `<script>` | ✅ blocked by the output guard |
| SEC-07b | HTML in AI proposals | ✅ plain text |
| SEC-08…12 | Prompt injection (EN, DE), key fishing, bulk export, hacking | ✅ refused on the device, **0 AI requests** |
| SEC-13 | Input > 4,000 characters | ✅ refused on the device |
| SEC-14 | AI reply with > 3 email addresses | ✅ blocked |
| SEC-15 | Provider error text containing a key | ✅ plain message, no key fragment |
| SEC-16 | Authorization header only towards OpenAI | ✅ |
| SEC-17 | Contacted origins during the whole run | ✅ only app, OpenAI, Google |
| SEC-18 ×3 | Tampered storage: invalid JSON, wrong field types, `javascript:` / foreign photo URLs | ✅ no crash, no script, no request to the foreign host |
| SEC-19 | Uncaught errors in the whole session | ✅ none |

### Features, layout, accessibility (`tests/e2e/features.cjs`) — 36 / 36

| ID | Feature | Result |
|---|---|---|
| F-01…03 | No key: clear hint, no request. Invalid key rejected; valid key shown as dots only | ✅ |
| F-04, F-05 | Company created and kept after reload; person linked to two companies (many-to-many) | ✅ |
| F-06…08 | Task status persists after reload; a done task stays done; tasks appear on the company page | ✅ |
| F-09…13 | Voice review: existing company recognised (still 1 × Schreinerei Huber), Save disabled before decisions, accept/edit/reject, links correct, repeat shows "already in the CRM" | ✅ |
| F-14…17 | AI errors 401, 500, network, malformed JSON → clear messages, no crash | ✅ |
| F-18 | Rate limit: at most 20 AI requests per minute, then a clear message | ✅ exactly 20 |
| F-19, F-20 | Knowledge search ("shower"), tutorial with steps and images | ✅ |
| F-21, F-22 | Quote extraction (missing dimension flagged), Transfer to Safir kept after reload | ✅ |
| F-23, F-24 | 12-stop route: valid Google Maps link (≤ 9 waypoints per part, 2 parts); map preview has a chip for every drive | ✅ |
| F-25, F-26 | Lead search static (no external request); simap tab present and empty | ✅ |
| F-27, F-28 | German UI and demo data; back to English | ✅ |
| F-29 ×6 | No horizontal overflow at 320, 360, 390, 768, 1280, 1920 px on 13 routes | ✅ |
| F-30 | axe WCAG 2.1 A/AA on 13 routes × phone + desktop | ✅ 0 violations |
| F-31 | No uncaught page errors | ✅ |

### Unit tests (`npm test`) — 46 / 46

| File | What it proves |
|---|---|
| `src/store/validate.test.ts` | Bad records are dropped or coerced, duplicates removed, fallbacks used |
| `src/lib/guard.test.ts` | 12 misuse phrases refused, 10 normal phrases allowed (incl. "crack", "bypass", scoped contacts), output guard, foreign script detection, 20-per-minute limit |
| `src/lib/route.test.ts` | Every stop once; **equals brute-force optimum** for 8 stops (5 seeds); start position honoured; parts of ≤ 11 points chain correctly; valid `api=1` link |
| `src/lib/interpret.test.ts` | Existing companies recognised, new items linked, proposals start undecided, existing tasks not proposed again, repeated task with a new person becomes an update, unknown references dropped, duplicates within one message removed |

### Not tested, and why

| Item | Reason |
|---|---|
| Real OpenAI answers (quality, latency, real error bodies) | No real key used in the audit; all AI calls were mocked |
| Real microphone recording and transcription | Headless browser has no microphone; the recorder's cleanup was reviewed in code (`useRecorder.ts` stops tracks, timer and audio context on stop, cancel and unmount) |
| Google Maps rendering and the real Maps app | Google is blocked in the test sandbox; links were checked by URL structure |
| Live Vercel deployment and its headers | The live URL returns 403 from the sandbox proxy. The same `vercel.json` headers were verified on `vite preview` |
| iOS Safari / Android Chrome on real devices | Only Chromium with phone emulation; real-device test recommended (voice, haptics, Maps app links) |
| Screen readers (VoiceOver, TalkBack) | axe covers automated WCAG rules only; manual screen-reader pass recommended |
| Load / large data sets | Not relevant for a single-browser prototype; the planner was timed at ~0.1 s for 30 stops |

---

## 6. Code quality and reliability

| Area | Observation |
|---|---|
| Types | Strict TypeScript, 0 errors. 7 `as unknown as` casts, all at the storage and seed boundary (now protected by the data cleaner). No `any` |
| Structure | Pages, components, `lib/` (pure logic), `store/`, `i18n/`. No duplicated store; one AI client; one guard module |
| Duplicated logic | Small: name-word helpers exist in both `assistant.ts` and `interpret.ts` (similar purpose, different rules). Acceptable; could share a helper |
| Memory leaks | Event listeners removed in effects; the recorder releases the microphone; module-level listeners exist once (`db.ts`). No leaks found |
| Error handling | AI errors mapped to clear messages; storage write failures fall back and warn; render errors caught by the new boundary |
| Dependencies | Runtime: `react`, `react-dom`, `react-router-dom`, `lucide-react`. Dev: Vite, TypeScript, oxlint, **Vitest, axe-core (added for tests)**. `npm audit`: 0 vulnerabilities |
| Performance | Production bundle 462 kB / 145 kB gzip; route planning 30 stops ≈ 0.1 s |

---

## 7. Fixes and verification

**Commit:** `2d01ae9` on `claude/upbeat-goldberg-wmihd0` (pushed). History was not rewritten, nothing was deployed and no data was deleted.

**Verification after the fixes:**

| Check | Result |
|---|---|
| `npm run build` (secret scan, type check, build, secret scan of `dist/`) | ✅ |
| `npx tsc -b` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors (12 warnings, R-7) |
| `npm test` | ✅ 46 / 46 |
| `npm run test:e2e` (security + features) | ✅ 22 / 22 and 36 / 36 |
| axe on 32 screens | ✅ 0 violations |
| `npm audit` | ✅ 0 vulnerabilities |
| CI on GitHub (first run of the new workflow, commit `2d01ae9`) | ✅ **success**: [run #1](https://github.com/Arvindmeen/Glass-Manufacturer-CRM/actions/runs/40917466959) |

**How to re-run:**

```bash
npm ci
npm test
npm run build
npm run preview          # keep it running
npm run test:e2e         # second terminal
```

---

## 8. Remaining risks and recommended actions

| Priority | Action |
|---|---|
| Before sharing the demo | Use a dedicated OpenAI key with a spend limit; revoke it after the review (R-1) |
| Before sharing the demo | Check the live site's headers: `curl -I https://glass-manufacturer-crm.vercel.app` should show the CSP, HSTS and X-Frame-Options |
| Before sharing the demo | Quick real-device pass on an iPhone and an Android phone: voice, Google Maps app link, haptics |
| Soon | Keep CI green; consider Dependabot/Renovate for dependency updates |
| Optional | Validate the website field; encode `mailto:`/`tel:` values (R-5, R-6) |
| Production | Implement the backend from `docs/ARCHITECTURE.md` (server-side key, logins and roles, tenant isolation); that resolves R-1 and R-2 |

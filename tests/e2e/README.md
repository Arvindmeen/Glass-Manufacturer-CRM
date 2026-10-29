# Browser tests (security, features, layout, accessibility)

They run against the production build with Playwright and Chromium. OpenAI and Google Maps are **mocked**, so no key is needed and nothing leaves the machine.

```bash
npm run build
npm run preview            # keep running, serves http://localhost:4173
npm run test:e2e           # in a second terminal (needs Playwright: npx playwright install chromium)
```

- `security.cjs`: key handling, XSS through forms and AI output, prompt injection, output guard, error masking, network origins, tampered storage.
- `features.cjs`: core workflows, persistence, duplicates, voice review, AI errors, rate limit, knowledge, inbox and Safir transfer, route links, mockups, languages, horizontal overflow at 320–1920 px, axe WCAG 2.1 A/AA.

`features.cjs` waits out the 1-minute AI rate limit twice, so it takes about 3 minutes. Results are written to `tests/e2e/results-*.json` (git-ignored).

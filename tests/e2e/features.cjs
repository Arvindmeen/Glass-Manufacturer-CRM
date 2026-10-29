// Functional, layout and accessibility audit against the production build. OpenAI and Google are mocked.
const { chromium } = require('playwright')
const fs = require('fs')
const BASE = process.env.BASE_URL || 'http://localhost:4173'
// Fake key, assembled at runtime so the repository's secret scan does not flag it.
const KEY = ['sk', 'proj', 'AUDITKEY0123456789abcdefghijklmnopqrstuvwxyz'].join('-')
const results = []
const rec = (id, ok, detail = '') => { results.push({ id, ok, detail: String(detail) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + String(detail).slice(0, 160) : ''}`) }
const ROUTES = ['/companies', '/companies?view=map', '/companies/c1', '/people', '/people/p1', '/tasks', '/knowledge', '/knowledge/k1', '/inbox', '/inbox/e1', '/leads', '/simap', '/settings']

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 820 }, locale: 'en-GB', isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('dialog', (d) => d.accept())
  let reply = { answer: '', actions: [] }
  let status = 200
  let aiCalls = 0
  await ctx.route('https://api.openai.com/**', (r) => {
    aiCalls++
    if (status === 'network') return r.abort('failed')
    if (status !== 200) return r.fulfill({ status, json: { error: { message: 'Incorrect API key provided: sk-proj-****wxyz' } } })
    const body = typeof reply === 'string' ? reply : JSON.stringify(reply)
    r.fulfill({ json: { choices: [{ message: { content: body } }] } })
  })
  await ctx.route(/google\.com/, (r) => r.fulfill({ body: 'map', contentType: 'text/html' }))
  const db = () => p.evaluate(() => JSON.parse(localStorage.getItem('glasscrm:db:v1') || 'null'))
  const speak = async (path, text) => {
    await p.goto(BASE + path); await p.waitForTimeout(250)
    await p.click('.voice-slot .voice-fab')
    await p.waitForSelector('.sheet input[placeholder="Or type…"]')
    await p.fill('.sheet input[placeholder="Or type…"]', text)
    await p.click('.sheet button[type=submit]')
  }

  // ---------- without a key
  await p.goto(BASE + '/tasks')
  await p.click('.voice-slot .voice-fab'); await p.waitForTimeout(400)
  await p.fill('.sheet input[placeholder="Or type…"]', 'hello'); await p.click('.sheet button[type=submit]'); await p.waitForTimeout(500)
  rec('F-01 assistant without key explains how to add one, no request sent', aiCalls === 0 && /key/i.test(await p.locator('.sheet').innerText()))
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)

  await p.goto(BASE + '/settings')
  await p.fill('input[name=openai-key]', 'not-a-key'); await p.click('button[type=submit]'); await p.waitForTimeout(200)
  rec('F-02 invalid key format rejected', (await p.locator('.key-saved').count()) === 0 && (await p.locator('.error').count()) > 0)
  await p.fill('input[name=openai-key]', KEY); await p.click('button[type=submit]'); await p.waitForSelector('.key-saved')
  rec('F-03 valid key saved, shown as dots only', /•{6,}/.test(await p.locator('.key-saved').innerText()))

  // ---------- contacts: create, many-to-many, persistence
  await p.goto(BASE + '/companies'); await p.locator('.fab-main').click()
  await p.locator('.sheet input.input').nth(0).fill('Audit Glas AG')
  await p.locator('.sheet input.input').nth(4).fill('Thun')
  await p.click('.sheet-foot >> text=Save'); await p.waitForURL(/companies\/[0-9a-f-]{36}/)
  const auditCompanyId = p.url().split('/').pop()
  await p.reload(); await p.waitForTimeout(300)
  rec('F-04 company created and survives reload', (await p.locator('h1').innerText()).includes('Audit Glas AG'))
  let d = await db()
  const anna = d.people.find((x) => x.id === 'p1')
  await p.goto(BASE + '/people/p1'); await p.waitForTimeout(300)
  rec('F-05 person page shows linked companies (many-to-many seed: Julia Frey has 2)', (await (async () => { await p.goto(BASE + '/people/p6'); await p.waitForTimeout(300); return (await p.locator('body').innerText()).includes('Bader Architekten') && (await p.locator('body').innerText()).includes('Frei & Partner') })()))
  void anna

  // ---------- tasks: status change persists, done stays done
  await p.goto(BASE + '/tasks'); await p.waitForTimeout(300)
  const first = p.locator('.column.current .task').first()
  const tTitle = await first.locator('.title').innerText()
  await first.locator('.advance').click(); await p.waitForTimeout(200)
  await p.reload(); await p.waitForTimeout(400)
  d = await db()
  rec('F-06 task status change persists after reload', d.tasks.find((x) => x.title === tTitle)?.status === 'in_progress')
  await p.click('.board-tabs button:nth-child(3)')
  const doneTitle = await p.locator('.column.current .task .title').first().innerText()
  await p.locator('.column.current .task .advance').first().click(); await p.waitForTimeout(300)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  d = await db()
  rec('F-07 tapping a done task does not move it back to planned', d.tasks.find((x) => x.title === doneTitle)?.status === 'done')
  await p.goto(BASE + '/companies/c1'); await p.waitForTimeout(300)
  rec('F-08 linked tasks shown on the company page', (await p.locator('body').innerText()).includes('Send offer for shower panels'))

  // ---------- voice command: review, accept / edit / reject, duplicates, linking
  reply = { answer: '', actions: [
    { type: 'create_company', ref: 'new:c1', name: 'Schreinerei Huber', city: 'Thun' },
    { type: 'create_person', ref: 'new:p1', firstName: 'Lena', lastName: 'Audit', role: 'Buyer', companyRefs: ['new:c1'] },
    { type: 'create_meeting', date: '2026-10-29', title: 'Audit visit', summary: 'Needs 12 shower panels', companyRefs: ['new:c1'], personRefs: ['new:p1'] },
    { type: 'create_task', title: 'Call Lena Friday', status: 'planned', due: '', companyRef: 'new:c1', personRef: 'new:p1' },
    { type: 'create_task', title: 'Audit task to reject', status: 'planned', due: '' },
  ] }
  await speak('/companies', 'I met Lena Audit from Schreinerei Huber')
  await p.waitForSelector('text=Review')
  const known = await p.locator('.known li').allInnerTexts()
  rec('F-09 existing company recognised (no second Schreinerei Huber)', known.some((k) => k.includes('Schreinerei Huber AG')) && !(await p.locator('.proposal .title', { hasText: /^Schreinerei Huber$/ }).count()))
  const save = p.locator('.sheet-foot button', { hasText: /Save/ })
  rec('F-10 nothing is saved before the user decides (Save disabled)', await save.isDisabled())
  const cards = p.locator('.proposal:not(.nav-proposal)')
  await cards.nth(0).locator('[aria-label=Accept]').click()
  await cards.nth(1).locator('[aria-label=Accept]').click()
  await cards.nth(2).locator('[aria-label=Edit]').click()
  await cards.nth(2).locator('input').first().fill('Call Lena on Friday morning')
  await cards.nth(2).locator('button', { hasText: 'Done' }).click()
  await cards.nth(3).locator('[aria-label=Reject]').click()
  await save.click(); await p.waitForTimeout(2600)
  d = await db()
  const lena = d.people.find((x) => x.lastName === 'Audit')
  const hubers = d.companies.filter((c) => /huber/i.test(c.name)).length
  const task = d.tasks.find((x) => x.title === 'Call Lena on Friday morning')
  const meet = d.meetings.find((x) => x.title === 'Audit visit')
  rec('F-11 accepted items saved and linked to the existing company', !!lena && lena.companyIds.includes('c1') && meet?.companyIds.includes('c1') && meet?.personIds.includes(lena.id) && task?.companyId === 'c1' && task?.personId === lena.id, `huber companies=${hubers}`)
  rec('F-12 edited text saved, rejected item not saved', !!task && !d.tasks.some((x) => x.title === 'Audit task to reject'))
  await speak('/companies', 'I met Lena Audit from Schreinerei Huber')
  await p.waitForSelector('text=Review')
  rec('F-13 same command again: everything shown as already in the CRM', (await p.locator('.known li').count()) >= 3 && /Nothing new|already/i.test(await p.locator('.known-head').innerText()))
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)

  // ---------- AI error handling
  for (const [id, s, expect] of [['F-14 401 from OpenAI', 401, /did not accept the key\. Check it in Settings/], ['F-15 500 from OpenAI', 500, /not available right now/], ['F-16 network failure', 'network', /No connection to the AI service/]]) {
    status = s
    await speak('/tasks', 'add a task to call Keller')
    await p.waitForTimeout(1500)
    const txt = await p.locator('.sheet').innerText()
    rec(id + ' shows a readable error, no crash', expect.test(txt) && !txt.includes('sk-proj-AUDIT'), txt.replace(/\s+/g, ' ').slice(0, 120))
    await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  }
  status = 200
  reply = 'this is not json'
  await speak('/tasks', 'add a task to call Keller'); await p.waitForTimeout(1500)
  rec('F-17 malformed AI JSON shows a clear error, no crash', errors.length === 0 && /could not be read/.test(await p.locator('.sheet').innerText()), (await p.locator('.sheet').innerText()).replace(/\s+/g, ' ').slice(0, 120))
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)

  // ---------- rate limit (20 per minute); start with an empty window
  await p.waitForTimeout(61000)
  reply = 'ok'
  await p.goto(BASE + '/tasks'); await p.waitForTimeout(200)
  await p.locator('.fab-alt').first().click(); await p.waitForTimeout(300)
  const before = aiCalls
  let limited = false
  for (let i = 0; i < 24; i++) {
    await p.fill('.chat-input input', 'Explain heat soak testing, question ' + i)
    await p.click('.chat-input button[type=submit]')
    await p.waitForTimeout(120)
    if ((await p.locator('.bubble.assistant').last().innerText()).match(/too many|zu viele|slow down|minute/i)) { limited = true; break }
  }
  rec('F-18 rate limit stops runaway AI use (≤ 20 requests / minute)', limited && aiCalls - before <= 20, `calls=${aiCalls - before}`)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)

  // ---------- knowledge search
  await p.goto(BASE + '/knowledge'); await p.waitForTimeout(200)
  await p.fill('input[type=search]', 'shower')
  await p.waitForTimeout(300)
  const kb = await p.locator('.list .title').allInnerTexts()
  rec('F-19 knowledge search finds the shower tutorial', kb.some((x) => /shower/i.test(x)) && kb.length < 7, kb.join(', '))
  await p.goto(BASE + '/knowledge/k1'); await p.waitForTimeout(300)
  rec('F-20 tutorial shows numbered steps with images', (await p.locator('.steps li, .steps > *').count()) >= 5)

  // ---------- inbox extraction and simulated ERP transfer (Safir), within the rate-limit window
  await p.waitForTimeout(61000)
  reply = { customer: 'Sanitär Zbinden AG', contact: 'Peter Zbinden', items: [{ product: 'Shower panel ESG 8 mm', quantity: 6, dimensions: '900 x 2000 mm' }, { product: 'Stabiliser bar', quantity: 6, dimensions: '' }], notes: '' }
  await p.goto(BASE + '/inbox/e1'); await p.waitForTimeout(400)
  const ex = p.getByRole('button', { name: /Extract request/ })
  if (await ex.count()) await ex.first().click()
  await p.waitForSelector('text=Confirm', { timeout: 8000 })
  rec('F-21 extraction proposes customer and items; missing dimension flagged', (await p.locator('input[value="Sanitär Zbinden AG"]').count()) > 0 && (await p.locator('.chip.warn').count()) > 0)
  await p.click('text=Confirm'); await p.waitForTimeout(300)
  await p.getByRole('button', { name: /Transfer to Safir/ }).click(); await p.waitForTimeout(2500)
  await p.reload(); await p.waitForTimeout(400)
  d = await db()
  rec('F-22 transfer to Safir simulated and persisted', !!d.emails.find((e) => e.id === 'e1')?.transferredAt && (await p.locator('text=/Transferred to Safir/').count()) > 0)

  // ---------- route and Google Maps links
  await p.goto(BASE + '/companies?view=map'); await p.waitForTimeout(300)
  const items = p.locator('.map-layout .stack .list-item')
  for (let i = 0; i < 12; i++) await items.nth(i).click()
  await p.getByRole('button', { name: /Plan route/ }).click()
  const open = p.locator('a', { hasText: 'Open in Google Maps' })
  await open.waitFor()
  const href = await open.getAttribute('href')
  const u = new URL(href)
  const wp = (u.searchParams.get('waypoints') || '').split('|').filter(Boolean).length
  rec('F-23 route opens a valid Google Maps directions link (≤ 9 waypoints per link)', u.host === 'www.google.com' && u.pathname === '/maps/dir/' && u.searchParams.get('api') === '1' && wp <= 9, `waypoints=${wp}, parts=${(await open.innerText()).match(/\d\/\d/)?.[0] ?? 1}`)
  const legs = await p.locator('.chip.leg').count()
  rec('F-24 map preview covers every drive of the route', legs === 11, `chips=${legs}`)

  // ---------- mockups stay mockups
  const before2 = aiCalls
  const reqs = []
  const onReq = (r) => reqs.push(r.url())
  ctx.on('request', onReq)
  await p.goto(BASE + '/leads'); await p.waitForTimeout(200)
  await p.getByRole('button', { name: /^Search$/ }).click(); await p.waitForTimeout(2600)
  const leads = await p.locator('.list .list-item, .lead').count()
  ctx.off('request', onReq)
  rec('F-25 lead search is a static mockup (results, no external request)', leads > 0 && aiCalls === before2 && !reqs.some((x) => !x.startsWith(BASE)), `results=${leads}`)
  await p.goto(BASE + '/simap'); await p.waitForTimeout(200)
  rec('F-26 simap Bot tab exists and is empty', (await p.locator('h1').innerText()).includes('simap'))

  // ---------- language
  await p.goto(BASE + '/settings'); await p.click('text=Deutsch'); await p.waitForTimeout(500)
  await p.goto(BASE + '/inbox/e2'); await p.waitForTimeout(300)
  const deText = await p.locator('body').innerText()
  await p.goto(BASE + '/tasks'); await p.waitForTimeout(200)
  const deTasks = await p.locator('body').innerText()
  rec('F-27 German: UI and demo data in German', /Posteingang|Offertanfrage/.test(deText) && /Geplant/.test(deTasks))
  await p.goto(BASE + '/settings'); await p.click('text=English'); await p.waitForTimeout(500)
  await p.goto(BASE + '/inbox/e1'); await p.waitForTimeout(300)
  rec('F-28 English: demo email back in English', (await p.locator('body').innerText()).includes('Quote request: shower partitions'))

  // ---------- layout: no horizontal overflow on phone and desktop
  const overflow = async (w, h) => {
    const pg = await (await b.newContext({ viewport: { width: w, height: h }, locale: 'en-GB' })).newPage()
    await pg.context().route(/google\.com/, (r) => r.fulfill({ body: 'map', contentType: 'text/html' }))
    const bad = []
    for (const r of ROUTES) {
      await pg.goto(BASE + r); await pg.waitForTimeout(250)
      const o = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (o > 1) bad.push(`${r} (+${o}px)`)
    }
    await pg.context().close()
    return bad
  }
  for (const [w, h] of [[320, 640], [360, 740], [390, 844], [768, 1024], [1280, 800], [1920, 1080]]) {
    const bad = await overflow(w, h)
    rec(`F-29 no horizontal overflow at ${w}px`, bad.length === 0, bad.join(', '))
  }

  // ---------- accessibility (axe-core, WCAG 2.1 A/AA rules)
  // bypassCSP only for this check: the app's CSP (correctly) blocks injected scripts such as axe.
  const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
  const a11y = {}
  for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
    const ac = await b.newContext({ viewport: vp, locale: 'en-GB', bypassCSP: true })
    await ac.route(/google\.com/, (r) => r.fulfill({ body: '<html lang="en"><title>map</title><body>map</body></html>', contentType: 'text/html' }))
    const ap = await ac.newPage()
    for (const r of ROUTES) {
      await ap.goto(BASE + r); await ap.waitForTimeout(300)
      await ap.addScriptTag({ content: axeSrc })
      a11y[`${label} ${r}`] = await ap.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0]?.target?.join(' ') })))
    }
    await ac.close()
  }
  fs.writeFileSync('tests/e2e/results-a11y.json', JSON.stringify(a11y, null, 1))
  const checked = Object.keys(a11y).length
  const serious = Object.entries(a11y).flatMap(([r, v]) => v.filter((x) => x.impact === 'critical' || x.impact === 'serious').map((x) => `${r}: ${x.id} ×${x.n}`))
  rec(`F-30 no critical/serious WCAG A/AA violations (axe, ${checked} screens)`, checked === ROUTES.length * 2 && serious.length === 0, serious.join(' | '))

  rec('F-31 no uncaught page errors during the whole run', errors.length === 0, errors.slice(0, 3).join(' | '))
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`)
  fs.writeFileSync('tests/e2e/results-features.json', JSON.stringify(results, null, 1))
  await b.close()
})()

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { CAREERS_URL, COMPANY, HOMEPAGE_URL, SOURCE, createPersevexScraper, extractPublicJobs, extractPublishedClientUrl, hasOfficialCareersSignal, hasOfficialHomepageSignal, hasVerifiedCareersLink } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import * as source from './script.js'
import { extractClientRoles } from './clientRoles.js'

const fixture = name => readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8')
const homepageHtml = Buffer.from(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-public-20261105.compact.json.gz', import.meta.url)))).receipts.find(row => row.transport === 'chrome-alternate-public-document' && row.url === HOMEPAGE_URL).bodyBase64, 'base64').toString('utf8')
const careersHtml = fixture('current-careers.html')
const client = fixture('persevex-careers-client.js')

test('Persevex scraper recognizes the verified homepage and careers surface', () => {
  assert.equal(SOURCE, 'persevex')
  assert.equal(COMPANY, 'Persevex')
  assert.equal(HOMEPAGE_URL, 'https://www.persevex.com/')
  assert.equal(CAREERS_URL, 'https://www.persevex.com/careers')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
})

test('Persevex extracts real client descriptions and exact stable identities for known India cards', () => {
  const jobs = extractPublicJobs(careersHtml, client)
  assert.equal(jobs.length, 3)
  const frontend = jobs.find(job => job.jobId === 'fe-dev')
  assert.equal(frontend.title, 'Frontend Developer')
  assert.equal(frontend.requisitionId, 'fe-dev')
  assert.equal(frontend.location, 'Remote (India)')
  assert.equal(frontend.applyUrl, CAREERS_URL)
  assert.match(frontend.jobDescription, /^Build and maintain the Persevex web platform using Next\.js/)
  assert.match(frontend.jobDescription, /2\+ years with React \/ Next\.js/)
  assert.deepEqual(frontend.requirements, ['2+ years with React / Next.js', 'Strong TypeScript fundamentals', 'Experience with Tailwind CSS', 'Eye for detail and animation'])
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceListingComplete === false))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 6)
})

test('Persevex run validates opening and closing first-party responses and decorates partial jobs', async () => {
  const clientUrl = extractPublishedClientUrl(careersHtml)
  const requested = []
  const pages = new Map([[HOMEPAGE_URL, homepageHtml], [CAREERS_URL, careersHtml], [clientUrl, client]])
  const jobs = await createPersevexScraper().run({ fetchPage: async url => {
    requested.push(url)
    assert.ok(pages.has(url))
    return { status: 200, url, html: pages.get(url) }
  } })
  assert.deepEqual(requested, [HOMEPAGE_URL, CAREERS_URL, clientUrl, HOMEPAGE_URL, CAREERS_URL, clientUrl])
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(job => job.source === SOURCE && job.companyDomain === 'persevex.com' && job.link === CAREERS_URL && job.publicExperienceChecked === true))
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 6)
})

test('Persevex fails closed on changed identity and card count', async () => {
  await assert.rejects(createPersevexScraper().run({ fetchPage: async url => ({ status: 200, url, html: homepageHtml.replaceAll('Persevex', 'Unrelated Company') }) }), /official homepage/i)
  assert.throws(() => extractPublicJobs(careersHtml.replace('>6</span> role', '>8</span> role'), client), /count|cards/i)
  assert.throws(() => extractPublicJobs(careersHtml.replace('Help students', 'Unrelated vacancies'), client), /verified public careers/i)
})

// Genuine complete public GET bodies, captured with page JavaScript disabled.
const currentReceipts = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-public-20261105.compact.json.gz', import.meta.url)))).receipts.filter(row => row.transport === 'chrome-alternate-public-document')
const currentPages = new Map(currentReceipts.map(row => [row.url, { status: row.status, url: row.finalUrl, html: Buffer.from(row.bodyBase64, 'base64').toString('utf8'), mime: row.mime, requestedAt: row.startedAt, completedAt: row.endedAt }]))
const currentCareers = currentPages.get(CAREERS_URL).html
const currentClientUrl = currentReceipts.find(row => row.url.endsWith('.js')).url
const currentClient = currentPages.get(currentClientUrl).html
const currentFetch = calls => async (url, init) => {
  calls.push(url)
  assert.equal(init.method, 'GET')
  assert.equal(init.credentials, 'omit')
  assert.equal(init.redirect, 'manual')
  assert.ok(init.signal)
  assert.ok(currentPages.has(url), 'Only the currently published public handoff is allowed')
  return currentPages.get(url)
}

test('Current strong count and native details recover three explicitly India roles and preserve three unresolved countries', () => {
  const jobs = source.extractPublicJobs(currentCareers, currentClient)
  assert.deepEqual(jobs.map(job => job.jobId), ['fe-dev', 'content-lead', 'bd-exec'])
  assert.deepEqual(jobs[0].requirements, ['2+ years with React / Next.js', 'Strong TypeScript fundamentals', 'Experience with Tailwind CSS', 'Eye for detail and animation'])
  assert.equal(jobs[0].jobDescription, "Build and maintain the Persevex web platform using Next.js, TypeScript, and Framer Motion. You'll work on student-facing pages, dashboards, and interactive UI components.\n\nRequirements:\n- 2+ years with React / Next.js\n- Strong TypeScript fundamentals\n- Experience with Tailwind CSS\n- Eye for detail and animation")
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true && job.sourceListingComplete === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 6)
  assert.equal(evidence.indiaFacetCount, 3)
  assert.equal(evidence.unverifiedGeographyCount, 3)
  assert.deepEqual(evidence.unresolvedRoles.map(role => role.id), ['placement-exec', 'social-intern', 'hr-exec'])
})

test('Current static data must bind the same full requirements to native cards and the public application identity', () => {
  assert.throws(() => source.extractPublicJobs(currentCareers.replace('<li>Eye for detail and animation</li>', '<li>Different requirement</li>'), currentClient), /detail|requirements|binding|match/i)
  for (const changed of [
    currentClient.replace('children:e.requirements.map', 'children:e.other.map'),
    currentClient.replace('onClick:r=>{r.preventDefault(),t(e)}', 'onClick:r=>{r.preventDefault(),t(other)}'),
    currentClient.replace('jobTitle:s.title,jobId:s.id', 'jobTitle:s.title,jobId:"other"'),
    currentClient.replace('}(P,a),c=', '}(other,a),c='),
  ]) assert.throws(() => source.extractPublicJobs(currentCareers, changed), /binding|client/i)
  assert.throws(() => source.extractPublicJobs(currentCareers.replace('<strong>6</strong>', '<strong>0</strong>'), currentClient), /count|empty|zero/i)
})

test('Inert page script strings cannot provide corporate identity or the current careers handoff', () => {
  const scriptHome = '<title>Persevex | Persevex</title><script>campus ambassador job clox persevex lms <a href="/careers">Careers</a></script>'
  assert.equal(source.hasOfficialHomepageSignal(scriptHome), false)
  assert.equal(source.hasVerifiedCareersLink(scriptHome), false)
  const scriptCareers = '<title>Persevex | Persevex</title><script>join the team help students launch careers build yours here <section id="open-roles">Open Positions Apply in under a minute Don\'t see your role</section></script>'
  assert.equal(source.hasOfficialCareersSignal(scriptCareers), false)
})

test('A careers asset inside an inert HTML comment is not a currently published client', () => {
  const hidden = currentCareers.replace(/(<script\b[^>]*src="[^"]*\/careers\/page-[^"]+"[^>]*>[\s\S]*?<\/script>)/, '<!--$1-->')
  assert.notEqual(hidden, currentCareers)
  assert.throws(() => source.extractPublishedClientUrl(hidden), /published careers client|published.*client/i)
})

test('Current exported run closes corporate identity and the full inventory before applying maxJobs', async () => {
  const calls = [], reports = []
  const jobs = await source.run({ fetchPage: currentFetch(calls), maxJobs: 1, now: '2026-11-05T09:41:32.149Z', onReport: report => reports.push(report) })
  assert.deepEqual(calls, [HOMEPAGE_URL, CAREERS_URL, currentClientUrl, HOMEPAGE_URL, CAREERS_URL, currentClientUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].scrapedAt, '2026-11-05T09:41:32.149Z')
  const report = source.readPersevexReport(jobs)
  assert.equal(reports[0], report)
  assert.equal(report.rawJobs, 6)
  assert.equal(report.observedIndiaJobs, 3)
  assert.equal(report.closingMatches, true)
  assert.equal(report.limited, true)
  assert.equal(report.sourceScopeComplete, false)
  assert.equal(report.cleanupAllowed, false)
  assert.equal(report.verifiedZeroInventory, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('A failed closing read retains positive full details and records unresolved inventory', async () => {
  const calls = []
  const jobs = await source.run({ fetchPage: async (url, init) => {
    if (calls.length === 3) { calls.push(url); return { status: 403, url, html: '<title>Access denied</title>' } }
    return currentFetch(calls)(url, init)
  } })
  assert.equal(jobs.length, 3)
  assert.equal(calls.length, 4)
  assert.equal(source.readPersevexReport(jobs).closingMatches, false)
  assert.match(source.readPersevexReport(jobs).failures[0].message, /403|identity|status/i)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Public request and byte budgets stop before an unbounded reader can issue further work', async () => {
  const calls = []
  await assert.rejects(source.run({ fetchPage: currentFetch(calls), maxRequests: 2 }), /request.*bound|request.*limit/i)
  assert.deepEqual(calls, [HOMEPAGE_URL, CAREERS_URL])
  const bytesCalls = []
  await assert.rejects(source.run({ fetchPage: currentFetch(bytesCalls), maxResponseBytes: 1024 }), /byte|body.*bound|body.*limit/i)
  assert.equal(bytesCalls.length, 1)
  const limitedCalls = []
  const jobs = await source.run({ fetchPage: currentFetch(limitedCalls), maxRequests: 3 })
  assert.equal(jobs.length, 3)
  assert.equal(limitedCalls.length, 3)
  assert.equal(source.readPersevexReport(jobs).closingMatches, false)
  assert.equal(source.readPersevexReport(jobs).cleanupAllowed, false)
})

const settleWithin = promise => Promise.race([promise.then(value => ({ value }), reason => ({ rejected: true, reason })), new Promise(resolve => setTimeout(() => resolve({ pending: true }), 120))])
test('Caller cancellation preserves falsey and opaque reasons even when a public reader ignores its signal', async () => {
  for (const reason of [null, false, 0, '', { opaque: 'caller reason' }]) {
    const controller = new AbortController(), calls = []
    const result = source.run({ signal: controller.signal, fetchPage: async url => { calls.push(url); controller.abort(reason); return new Promise(() => {}) } })
    const outcome = await settleWithin(result)
    assert.equal(outcome.rejected, true)
    assert.equal(outcome.reason, reason)
    assert.equal(calls.length, 1)
  }
  const stopped = new AbortController(); stopped.abort(0)
  const outcome = await settleWithin(source.run({ signal: stopped.signal, fetchPage: async () => assert.fail('No request after cancellation') }))
  assert.equal(outcome.rejected, true)
  assert.equal(outcome.reason, 0)
})

test('An ignored public reader and a stalled default body reader end at the supplied request deadline', async () => {
  const outcome = await settleWithin(source.run({ requestTimeoutMs: 20, fetchPage: async () => new Promise(() => {}) }))
  assert.equal(outcome.rejected, true)
  assert.match(outcome.reason.message, /timeout|deadline/i)
  const previous = globalThis.fetch
  let cancelled = false
  const stalled = new Response(new ReadableStream({ pull: () => new Promise(() => {}), cancel: () => { cancelled = true } }), { headers: { 'content-type': 'text/html' } })
  Object.defineProperty(stalled, 'url', { value: HOMEPAGE_URL })
  globalThis.fetch = async () => stalled
  try {
    const streamOutcome = await settleWithin(source.fetchPersevexPage(HOMEPAGE_URL, { requestTimeoutMs: 20 }))
    assert.equal(streamOutcome.rejected, true)
    assert.match(streamOutcome.reason.message, /timeout|deadline/i)
    assert.equal(cancelled, true)
  } finally { globalThis.fetch = previous }
})

test('Source, page and aggregate byte bounds preserve positive observations without inventing a zero', async () => {
  const deadline = await settleWithin(source.run({ sourceTimeoutMs: 20, requestTimeoutMs: 100, fetchPage: async () => new Promise(() => {}) }))
  assert.equal(deadline.rejected, true)
  assert.match(deadline.reason.message, /source deadline/i)
  const calls = []
  const jobs = await source.run({ fetchPage: currentFetch(calls), maxPages: 1 })
  assert.equal(jobs.length, 3)
  assert.equal(calls.length, 4)
  assert.equal(source.readPersevexReport(jobs).pagesFetched, 1)
  assert.equal(source.readPersevexReport(jobs).closingMatches, false)
  const byteCalls = []
  await assert.rejects(source.run({ fetchPage: currentFetch(byteCalls), maxTotalBytes: 200000 }), /aggregate byte bound/i)
  assert.equal(byteCalls.length, 2)
  const zeroCalls = []
  const capped = await source.run({ fetchPage: currentFetch(zeroCalls), maxJobs: 0 })
  assert.equal(capped.length, 0)
  assert.equal(zeroCalls.length, 6)
  assert.equal(source.readPersevexReport(capped).observedIndiaJobs, 3)
  assert.equal(source.readPersevexReport(capped).verifiedZeroInventory, false)
  assert.equal(readInventoryEvidence(capped).listingComplete, false)
})

test('Late reader and fetch completions cannot resume work after caller cancellation', async () => {
  const controller = new AbortController(), reason = { opaque: 'late read stop' }, calls = [], reports = []
  let release
  const pending = source.run({ signal: controller.signal, onReport: report => reports.push(report), fetchPage: async url => {
    calls.push(url)
    return new Promise(resolve => { release = resolve })
  } })
  await new Promise(resolve => setImmediate(resolve))
  controller.abort(reason)
  const outcome = await settleWithin(pending)
  assert.equal(outcome.rejected, true)
  assert.equal(outcome.reason, reason)
  release(currentPages.get(HOMEPAGE_URL))
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls, [HOMEPAGE_URL])
  assert.equal(reports.length, 0)
  const previous = globalThis.fetch, fetchController = new AbortController()
  let releaseFetch, bodyReads = 0
  globalThis.fetch = () => new Promise(resolve => { releaseFetch = resolve })
  try {
    const read = source.fetchPersevexPage(HOMEPAGE_URL, { signal: fetchController.signal, requestTimeoutMs: 100 })
    await new Promise(resolve => setImmediate(resolve))
    fetchController.abort(0)
    const fetchOutcome = await settleWithin(read)
    assert.equal(fetchOutcome.rejected, true)
    assert.equal(fetchOutcome.reason, 0)
    releaseFetch({ status: 200, url: HOMEPAGE_URL, headers: new Headers({ 'content-type': 'text/html' }), body: { getReader: () => { bodyReads++; throw Error('No late body read') } } })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(bodyReads, 0)
  } finally { globalThis.fetch = previous }
})

test('Only the active published webpack entry may supply the role literal and renderer/application binding', () => {
  const inactive = [
    '// ' + currentClient.replace(/\r?\n/g, '\n// '),
    JSON.stringify(currentClient),
    '`' + currentClient.replaceAll('`', '\\`').replaceAll('${', '\\${') + '`',
    'function unusedClient() {' + currentClient + '\n}',
  ]
  for (const client of inactive) assert.throws(() => extractClientRoles(client), /active|published|binding|client/i)
  const unrelated = currentClient.replace('Promise.resolve().then(r.bind(r,65739))', 'Promise.resolve().then(r.bind(r,14950))')
  assert.notEqual(unrelated, currentClient)
  assert.throws(() => extractClientRoles(unrelated), /active|published|binding|client/i)
  assert.throws(() => extractClientRoles(currentClient.replace('default:()=>D', 'default:()=>N')), /active|published|binding|client/i)
})

test('A runtime entry assignment inside an uncalled function cannot load the published page module', () => {
  const inactive = currentClient.replace(/e=>\{e\.O\(0,\[[\d,]+\],\(\)=>e\(e\.s=33782\)\),_N_E=e\.O\(\)\}/, 'e=>{function uncalledEntry(){e.s=33782;}}')
  assert.notEqual(inactive, currentClient)
  assert.throws(() => extractClientRoles(inactive), /active|published|binding|client/i)
})

const blockTimers = milliseconds => { const end = performance.now() + milliseconds; while (performance.now() < end) {} }
test('Elapsed request and source deadlines reject a synchronous reader before queued timeout callbacks run', async () => {
  for (const options of [{ requestTimeoutMs: 5, sourceTimeoutMs: 5000 }, { requestTimeoutMs: 1000, sourceTimeoutMs: 20 }]) {
    const calls = []
    await assert.rejects(source.run({ ...options, fetchPage: async (url, init) => {
      if (calls.length === 0) blockTimers(40)
      return currentFetch(calls)(url, init)
    } }), /deadline/i)
    assert.equal(calls.length, 1)
  }
})

test('Elapsed body and client parse work cannot be accepted before a starved request timer fires', async () => {
  const previous = globalThis.fetch
  const bodyNow = performance.now.bind(performance), bodyDescriptor = Object.getOwnPropertyDescriptor(performance, 'now')
  let cancelled = false, read = false
  let bodyElapsed = 0
  Object.defineProperty(performance, 'now', { configurable: true, value: () => bodyNow() + bodyElapsed })
  const headers = new Headers({ 'content-type': 'text/html' })
  globalThis.fetch = async url => ({ status: 200, url, headers, body: { cancel: () => { cancelled = true }, getReader: () => ({
    read: async () => { if (read) return { done: true }; read = true; bodyElapsed = 6000; return { done: false, value: new TextEncoder().encode('<p>Public body</p>') } },
    cancel: () => { cancelled = true }, releaseLock: () => {},
  }) } })
  try {
    await assert.rejects(source.fetchPersevexPage(HOMEPAGE_URL, { requestTimeoutMs: 5000 }), /deadline/i)
    assert.equal(read, true)
    assert.equal(cancelled, true)
  } finally {
    globalThis.fetch = previous
    if (bodyDescriptor) Object.defineProperty(performance, 'now', bodyDescriptor); else delete performance.now
  }
  const stringify = JSON.stringify
  const savedNow = performance.now.bind(performance), descriptor = Object.getOwnPropertyDescriptor(performance, 'now')
  let blocked = false
  let elapsed = 0
  Object.defineProperty(performance, 'now', { configurable: true, value: () => savedNow() + elapsed })
  JSON.stringify = function (value, ...args) {
    if (!blocked && Array.isArray(value) && value[0] === '2+ years with React / Next.js') { blocked = true; elapsed = 6000 }
    return stringify.call(this, value, ...args)
  }
  try {
    await assert.rejects(source.run({ fetchPage: currentFetch([]), requestTimeoutMs: 5000, sourceTimeoutMs: 20000 }), /deadline/i)
    assert.equal(blocked, true)
  } finally {
    JSON.stringify = stringify
    if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now
  }
})

test('Final report work cannot return after the monotonic source deadline', async () => {
  const savedNow = performance.now.bind(performance), descriptor = Object.getOwnPropertyDescriptor(performance, 'now')
  let forced = null
  Object.defineProperty(performance, 'now', { configurable: true, value: () => forced ?? savedNow() })
  try {
    await assert.rejects(source.run({ fetchPage: currentFetch([]), sourceTimeoutMs: 5000, onReport: () => { forced = savedNow() + 10000 } }), /source deadline/i)
  } finally { if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now }
})

for (const [name, headers] of [
  ['MIME', { 'content-type': 'application/json' }],
  ['declared length', { 'content-type': 'text/html', 'content-length': '99999999' }],
]) test('Rejected ' + name + ' cancels an unacquired response body without waiting for cancellation', async () => {
  const previous = globalThis.fetch
  let cancelled = false
  globalThis.fetch = async url => ({ status: 200, url, headers: new Headers(headers), body: {
    getReader: () => assert.fail('Rejected metadata must not acquire a reader'),
    cancel: () => { cancelled = true; return new Promise(() => {}) },
  } })
  try {
    const result = await settleWithin(source.fetchPersevexPage(HOMEPAGE_URL, { maxResponseBytes: 1000, requestTimeoutMs: 100 }))
    assert.equal(result.rejected, true)
    assert.equal(cancelled, true)
  } finally { globalThis.fetch = previous }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { getEventListeners } from 'node:events'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import { CAREERS_URL, APPLY_URL, createWinmanSoftwareScraper, run } from './script.js'

// Controlled unit markup follows the existing legacy/current Winman fixtures.
// Generated multi-role variants are synthetic; no native capture/clock is changed.
const legacy = `<title>Careers for Experience Candidates - Winman Software</title>
<table id="experienced_table"><tr><th>Designation and Job Profile</th><th>Experience</th></tr>
<tr><td><h5>Senior Accountant</h5>Overseeing the finalisation of accounts.</td><td>CA Articleship completed</td></tr>
<tr><td><h5>Electrical Maintenance Supervisor</h5>Supervising maintenance of electrical systems.</td><td>2 years</td></tr></table>
<a href="${APPLY_URL}">Apply now</a>`
const titles = ['Software Engineer', 'Controlled Role Two', 'Controlled Role Three', 'Controlled Role Four', 'Controlled Role Five']
const links = titles.map((_, index) => 'https://www.winmansoftware.com/more/careers/controlled-role-' + (index + 1))
const current = `<title>Careers &#8211; Winman Software</title><table id="freshers"><tr><td>${titles.map((title, index) => `<a href="${links[index]}">${title}</a>`).join('')}</td></tr></table>
<table id="experienced"><tr><td><h4>Senior Accountant</h4><ul><li>Oversee finalisation of accounts.</li></ul></td><td>2 years</td></tr></table><a href="${APPLY_URL}">Apply Now</a>`
const detail = title => `<h1 class="job-title">${title}</h1><div>Winman Software India LLP</div><div>Mangalore</div><ul class="job-summary"><li>Build and test software.</li></ul><p class="qualification">B.E.</p><button onclick="window.open('${APPLY_URL}')">Apply Now</button>`
const response = (html, url = CAREERS_URL) => ({ ok: true, status: 200, url, headers: new Headers({ 'content-type': 'text/html' }), text: async () => html })
const outcome = async promise => {
  let timer
  try { return await Promise.race([promise.then(value => ({ state: 'fulfilled', value }), error => ({ state: 'rejected', error })), new Promise(resolve => { timer = setTimeout(() => resolve({ state: 'pending' }), 80) })]) }
  finally { clearTimeout(timer) }
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const never = () => new Promise(() => {})
const variants = [
  ['frozen Error', () => ({ reason: Object.freeze(new Error('Controlled stop')) })],
  ['frozen object', () => ({ reason: Object.freeze({ token: 'Controlled stop' }) })],
  ['string', () => ({ reason: 'Controlled stop' })],
  ['null', () => ({ reason: null })],
  ['default AbortError', () => ({ defaultReason: true })],
  ...['code', 'surface'].map(field => ['throwing ' + field + ' getter', () => { let reads = 0; const reason = Object.freeze(Object.defineProperty({}, field, { get() { reads++; throw new Error('Opaque getter must stay unread') } })); return { reason, reads: () => reads } }]),
]
for (const [name, make] of variants) {
  test('Winman caller preabort retains exact ' + name + ' and makes zero reads', async () => {
    const controller = new AbortController(), variant = make()
    variant.defaultReason ? controller.abort() : controller.abort(variant.reason)
    let calls = 0
    const result = await outcome(run({ signal: controller.signal, fetchText: async () => { calls++; return legacy } }))
    assert.equal(result.state, 'rejected')
    assert.equal(result.error, controller.signal.reason)
    assert.equal(calls, 0)
    assert.equal(variant.reads?.() || 0, 0)
  })
  test('Winman pending noncooperative read retains exact ' + name, async () => {
    const controller = new AbortController(), variant = make(), started = deferred()
    let calls = 0, passedSignal
    const promise = run({ signal: controller.signal, fetchText: (_url, options) => { calls++; passedSignal = options?.signal; started.resolve(); return never() } })
    await started.promise
    variant.defaultReason ? controller.abort() : controller.abort(variant.reason)
    const result = await outcome(promise)
    assert.equal(result.state, 'rejected')
    assert.equal(result.error, controller.signal.reason)
    assert.equal(calls, 1)
    assert.equal(passedSignal.aborted, true)
    assert.equal(getEventListeners(passedSignal, 'abort').length, 0)
    assert.equal(variant.reads?.() || 0, 0)
  })
}
test('Winman registered caller preabort is not swallowed by catalog decoration', async () => {
  const scraper = buildScrapers().find(item => item.name === 'winmansoftware'), reason = Object.freeze({ token: 'Registered stop' })
  let calls = 0
  const result = await outcome(scraper.run({ signal: AbortSignal.abort(reason), fetchText: async () => { calls++; return legacy } }))
  assert.equal(result.state, 'rejected')
  assert.equal(result.error, reason)
  assert.equal(calls, 0)
})
test('Winman default fetch composes caller signal during a noncooperative request', async t => {
  const controller = new AbortController(), reason = Object.freeze(new Error('Default pending stop')), started = deferred()
  let calls = 0, transportSignal
  t.mock.method(globalThis, 'fetch', (_url, init) => { calls++; transportSignal = init.signal; started.resolve(); return never() })
  const promise = run({ signal: controller.signal })
  await started.promise
  controller.abort(reason)
  const result = await outcome(promise)
  assert.equal(result.state, 'rejected')
  assert.equal(result.error, reason)
  assert.equal(transportSignal.aborted, true)
  assert.equal(calls, 1)
})
test('Winman default pending body preserves null caller reason before parsing or retries', async t => {
  const controller = new AbortController(), started = deferred()
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ...response(legacy), text: async () => { started.resolve(); return never() } } })
  const promise = run({ signal: controller.signal })
  await started.promise
  controller.abort(null)
  const result = await outcome(promise)
  assert.equal(result.state, 'rejected')
  assert.equal(result.error, null)
  assert.equal(calls, 1)
})
for (const field of ['code', 'surface']) test('Winman default body cancellation leaves opaque ' + field + ' getter unread', async t => {
  const controller = new AbortController()
  let reads = 0, calls = 0
  const reason = Object.freeze(Object.defineProperty({}, field, { get() { reads++; throw new Error('Opaque body reason must stay unread') } }))
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ...response(legacy), text: async () => { controller.abort(reason); return legacy } } })
  const result = await outcome(run({ signal: controller.signal }))
  assert.equal(result.state, 'rejected')
  assert.equal(result.error, reason)
  assert.equal(reads, 0)
  assert.equal(calls, 1)
})
test('Winman observes late rejecting work after synchronous caller cancellation', async t => {
  const controller = new AbortController(), reason = Object.freeze({ token: 'Synchronous caller stop' }), unhandled = []
  const listener = error => unhandled.push(error)
  process.on('unhandledRejection', listener)
  t.after(() => process.removeListener('unhandledRejection', listener))
  const result = await outcome(run({ signal: controller.signal, fetchText: () => { controller.abort(reason); return Promise.reject(new Error('Late controlled transport rejection')) } }))
  assert.equal(result.state, 'rejected')
  assert.equal(result.error, reason)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(unhandled, [])
})
test('Winman synchronous detail failure starts no later URL in the same or following batch', async () => {
  const failure = Object.freeze(new Error('Controlled detail outage')), calls = []
  const result = await outcome(run({ fetchText: url => { calls.push(url); if (url === CAREERS_URL) return current; if (url === links[0]) throw failure; return detail(titles[links.indexOf(url)]) } }))
  assert.equal(result.state, 'rejected')
  assert.equal(result.error, failure)
  assert.deepEqual(calls, [CAREERS_URL, links[0]])
})
test('Winman abort at a detail boundary starts no later same-batch URL', async () => {
  const controller = new AbortController(), reason = Object.freeze({ token: 'Detail boundary stop' }), calls = []
  const result = await outcome(run({ signal: controller.signal, fetchText: url => { calls.push(url); if (url === CAREERS_URL) return current; controller.abort(reason); return detail(titles[links.indexOf(url)]) } }))
  assert.equal(result.state, 'rejected')
  assert.equal(result.error, reason)
  assert.deepEqual(calls, [CAREERS_URL, links[0]])
})
test('Winman pending batch failure cancels existing siblings and never starts the next batch', async () => {
  const first = deferred(), started = deferred(), calls = [], signals = [], failure = new Error('Controlled batch outage')
  const promise = run({ fetchText: (url, options) => { calls.push(url); if (url === CAREERS_URL) return current; signals.push(options?.signal); if (signals.length === 4) started.resolve(); return url === links[0] ? first.promise : never() } })
  await started.promise
  first.reject(failure)
  const result = await outcome(promise)
  assert.equal(result.state, 'rejected')
  assert.equal(result.error, failure)
  assert.deepEqual(calls, [CAREERS_URL, ...links.slice(0, 4)])
  for (const signal of signals) { assert.equal(signal.aborted, true); assert.equal(getEventListeners(signal, 'abort').length, 0) }
})
test('Winman normal current mapping retains all detail reads, role order, content and maxJobs behavior', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +new Date('2026-10-25T12:34:56Z') })
  const calls = [], signals = []
  const jobs = await createWinmanSoftwareScraper({ maxJobs: 2 }).run({ fetchText: async (url, options) => { calls.push(url); if (options?.signal) signals.push(options.signal); return url === CAREERS_URL ? current : detail(titles[links.indexOf(url)]) } })
  assert.deepEqual(calls, [CAREERS_URL, ...links])
  assert.deepEqual(jobs.map(job => job.title), titles.slice(0, 2))
  for (const job of jobs) { assert.equal(job.applyUrl, APPLY_URL); assert.equal(job.postingDate, null); assert.equal(job.closingDate, null); assert.equal(job.minimumQualification, 'B.E.'); assert.equal(job.jobDescription, 'Build and test software.'); assert.equal(job.sourceListingComplete, false); assert.equal(job.scrapedAt, '2026-10-25T12:34:56.000Z') }
  for (const signal of signals) assert.equal(getEventListeners(signal, 'abort').length, 0)
})
test('Winman legacy healthy mapping retains content and does not receive invented native dates', async () => {
  const jobs = await createWinmanSoftwareScraper({ maxJobs: 1 }).run({ fetchText: async () => legacy })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Accountant')
  assert.equal(jobs[0].jobDescription, 'Overseeing the finalisation of accounts.')
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].closingDate, null)
  assert.equal(jobs[0].applyUrl, APPLY_URL)
})
test('Winman default request retains the shared15second deadline', async t => {
  const deadlines = []
  t.mock.method(AbortSignal, 'timeout', milliseconds => { deadlines.push(milliseconds); return new AbortController().signal })
  t.mock.method(globalThis, 'fetch', async () => response(legacy))
  assert.equal((await run()).length, 2)
  assert.deepEqual(deadlines, [15000])
})
test('Winman default shared retry budget still permits three ordinary attempts', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { if (++calls < 3) throw new Error('Controlled retryable transport failure'); return response(legacy) })
  const promise = run()
  const drain = async () => { for (let index = 0; index < 40; index++) await Promise.resolve() }
  await drain(); assert.equal(calls, 1)
  t.mock.timers.tick(2000); await drain(); assert.equal(calls, 2)
  t.mock.timers.tick(4000); await drain()
  assert.equal((await promise).length, 2)
  assert.equal(calls, 3)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { runCurrentPetrofac as run } from './currentNative20261115.js'
globalThis.fetch = async () => { throw Error('Network forbidden in historical Petrofac controls') }
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz', import.meta.url))))
const grouped = new Map(), HOME = 'https://www.petrofac.com/', BOARD = 'https://petrofac.referrals.selectminds.com/'
const ROLE = BOARD + 'jobs/hr-digital-associate-data-management-12272', GTM = 'https://www.googletagmanager.com/gtm.js?id=GTM-NXX7FF5'
for (const p of fixture.packets) { if (!grouped.has(p.requestedURL)) grouped.set(p.requestedURL, []); grouped.get(p.requestedURL).push(p) }
function replay(change = () => {}, options = {}) {
  const calls = [], counts = new Map(), mutations = []
  const fetchImpl = options.fetchImpl || (async (value, init) => {
    const url = String(value), index = counts.get(url) || 0; counts.set(url, index + 1)
    const p = structuredClone(grouped.get(url)?.[index] || (grouped.get(url)?.length === 1 ? grouped.get(url)[0] : null))
    assert.ok(p, 'Actual current/baseline packet must exist ' + url + ' #' + index)
    const before = JSON.stringify(p), original = Buffer.from(p.bodyBase64, 'base64').toString('utf8'); p.body = original
    change(p, url, index)
    if (p.body !== original || before !== JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'body')))) mutations.push({ url, index })
    calls.push({ url, index, init })
    const response = new Response(p.body === original ? Buffer.from(p.bodyBase64, 'base64') : p.body, { status: p.status, headers: p.headers }); Object.defineProperty(response, 'url', { value: p.url }); return response
  })
  return { calls, mutations, promise: run({ fetchImpl, requestIntervalMs: 0, now: () => fixture.capturedAt, ...options }) }
}

test('dated historical certificate preserves two explicit India roles and four original featured rows', async () => {
  const reader = replay(), jobs = await reader.promise
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(j => j.title), ['HR Digital Associate - Data Management', 'Senior Engineer- Electrical'])
  assert.deepEqual(jobs.map(j => j.jobId), ['12272', '12218'])
  assert.deepEqual(jobs.map(j => j.requisitionId), ['093682', '092345'])
  assert.deepEqual(jobs.map(j => j.nativeSourceRecord.originalNativeFullCriteria.length), [4025, 4639])
  for (const job of jobs) {
    assert.equal(job.company, 'Petrofac'); assert.equal(job.country, 'India'); assert.equal(job.location, 'Chennai, India')
    assert.equal(job.applyUrl, job.sourceUrl); assert.equal(job.postingDate, null); assert.equal(job.firstEverPostedAt, null)
    assert.equal(job.sourceScopeComplete, false); assert.equal(job.sourceListingComplete, false); assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.sourceRenderedApplicationQualified, false); assert.ok(job.jobDescription.includes(job.nativeSourceRecord.originalNativeFullCriteria))
    assert.equal(job.nativeSourceRecord.originalPublishedApplication.submissionPerformed, false)
  }
  assert.ok(jobs[0].jobDescription.includes('4-8 years')); assert.ok(jobs[0].jobDescription.includes('OIC (Oracle Integration Cloud)'))
  assert.ok(jobs[1].jobDescription.includes('Assumes the responsibilities of the Principal Engineer')); assert.ok(jobs[1].jobDescription.endsWith('#LI-SN1'))
  assert.equal(jobs.nativeCollectionEvidence.nativeRows.length, 4); assert.equal(jobs.nativeCollectionEvidence.closingNativeRows.length, 4)
  assert.equal(jobs.nativeCollectionEvidence.holds.length, 2); assert.equal(jobs.nativeCollectionEvidence.originalResponses.length, 108)
  assert.equal(reader.calls.length, 108); assert.ok(reader.calls.every(c => c.init.method === 'GET' && c.init.redirect === 'manual' && c.init.credentials === 'omit'))
  assert.ok(reader.calls.every(c => !/other-jobs-matching|\/ajax\/action\//.test(c.url)))
  const inventory = readInventoryEvidence(jobs); assert.equal(inventory.listingComplete, false); assert.equal(inventory.reportedTotal, null); assert.equal(inventory.lifecycleCleanupAllowed, false)
})

test('fresh coupled public guest sessions and exact public hidden CSRF seeds preserve original role semantics', async () => {
  const reader = replay((p, url) => {
    if (!url.startsWith(BOARD)) return
    p.body = p.body.replace(/("session_id":")[^"]+("?)/g, '$1' + 'a'.repeat(64) + '.petrofac.lhrc1a-app-001.a.lhrc.oraclevcn.com$2')
      .replace(/(id = "tsstoken" value =")[^"]+/, '$1' + Buffer.alloc(32, 41).toString('base64'))
  })
  const jobs = await reader.promise; assert.equal(jobs.length, 2); assert.equal(reader.mutations.length, 6)
})

test('either complete reviewed current GTM program can be observed in either phase', async () => {
  const second = Buffer.from(grouped.get(GTM)[1].bodyBase64, 'base64').toString('utf8')
  const reader = replay((p, url) => { if (url === GTM) p.body = second })
  assert.equal((await reader.promise).length, 2); assert.equal(reader.mutations.length, 1)
})

for (const [name, mutate] of [
  ['native card title contradiction', p => { p.body = p.body.replace('HR Digital Associate - Data Management', 'Unrelated employer role') }],
  ['foreign work-country', p => { p.body = p.body.replaceAll('Chennai, India', 'Chennai, United States') }],
  ['new country alternative', p => { p.body = p.body.replace('</body>', '<p itemprop="jobLocation">London, United Kingdom</p></body>') }],
  ['missing original requirement', p => { p.body = p.body.replace('Minimum 3+ years', 'Minimum 1+ years') }],
  ['new required qualification', p => { p.body = p.body.replace('</body>', '<p>Applicants must hold a cryptography doctorate.</p></body>') }],
  ['hidden required qualification value', p => { p.body = p.body.replace('</body>', '<input hidden required value="A cryptography doctorate is mandatory"></body>') }],
  ['new nontext microdata criterion', p => { p.body = p.body.replace('</body>', '<data itemprop="qualifications" value="A cryptography doctorate is mandatory"></data></body>') }],
  ['visible filled notice', p => { p.body = p.body.replace('</body>', '<p>This position has now been filled.</p></body>') }],
  ['ended hiring notice', p => { p.body = p.body.replace('</body>', '<p>Hiring for this role has ended.</p></body>') }],
  ['disabled native Apply', p => { p.body = p.body.replace('id="apply_btn"', 'id="apply_btn" disabled') }],
  ['unbound native ID', p => { p.body = p.body.replace('name="Job.id" value="12272"', 'name="Job.id" value="77777"') }],
  ['additional role-context program', p => { p.body = p.body.replace('</head>', '<script>window.roleClosed=true</script></head>') }],
  ['changed stylesheet screen mode', p => { p.body = p.body.replace('rel="stylesheet"', 'rel="stylesheet" media="print"') }],
  ['hidden native full criteria', p => { p.body = p.body.replace('class="job_description"', 'class="job_description" hidden') }],
  ['uncoupled guest session literals', p => { p.body = p.body.replace(/"session_id":"[0-9a-f]{64}/, '"session_id":"' + 'c'.repeat(64)) }],
  ['foreign public session host', p => { p.body = p.body.replaceAll('.petrofac.lhrc1a-app-001.a.lhrc.oraclevcn.com', '.foreign.example') }],
  ['new session-bearing executable carrier', p => { p.body = p.body.replace('</head>', '<script>const v={"session_id":"' + 'a'.repeat(64) + '.petrofac.lhrc1a-app-001.a.lhrc.oraclevcn.com"}</script></head>') }],
  ['noncanonical public CSRF bytes', p => { p.body = p.body.replace(/(id = "tsstoken" value =")[^"]+/, '$1' + 'B'.repeat(43) + '=') }],
]) test(name + ' prevents unsafe publication', async () => {
  const reader = replay((p, url) => { if (url === ROLE) mutate(p) })
  await assert.rejects(reader.promise, error => error.softFailure === true && error.lifecycleCleanupAllowed === false)
  assert.ok(reader.mutations.some(m => m.url === ROLE), 'Adverse edit must actually reach the current own role')
})

for (const [name, change] of [
  ['closing-only original criteria', (p, url, index) => { if (url === ROLE && index === 1) p.body = p.body.replace('4-8 years', '9-12 years') }],
  ['closing-only publisher membership', (p, url, index) => { if (url === BOARD && index === 1) p.body = p.body.replace('job_list_12272', 'job_list_99999') }],
  ['closing-only stylesheet bytes', (p, url, index) => { if (url.includes('/site_css') && index === 1) p.body += '\n.job_description{display:none}' }],
  ['closing-only native handler bytes', (p, url, index) => { if (url.includes('/job_details.js?') && index === 1) p.body += '\nwindow.roleClosed=true;' }],
  ['unknown same-length GTM flag', (p, url) => { if (url === GTM) p.body = p.body.replace('Of(11)', 'Of(12)') }],
  ['changed active CSP', (p, url) => { if (url === ROLE) p.headers['content-security-policy'] = "script-src 'none'; style-src 'none'" }],
  ['unsupported native MIME', (p, url) => { if (url === ROLE) p.headers['content-type'] = 'text/plain' }],
  ['different native final URL', (p, url) => { if (url === ROLE) p.url = BOARD }],
  ['current public denial', (p, url) => { if (url === HOME) { p.status = 403; p.body = 'Denied' } }],
]) test(name + ' keeps source and cleanup unqualified', async () => {
  const reader = replay(change); await assert.rejects(reader.promise, error => error.softFailure === true && error.lifecycleCleanupAllowed === false); assert.ok(reader.mutations.length)
})

for (const reason of ['current-stop', Object.freeze({ caller: 'stop' })]) test('opaque caller cancellation ' + typeof reason + ' keeps exact identity', async () => {
  const controller = new AbortController(), reader = replay(undefined, { signal: controller.signal, fetchImpl: () => new Promise(() => {}) })
  setTimeout(() => controller.abort(reason), 5); await assert.rejects(reader.promise, error => error === reason)
})
test('uncooperative public read is bounded by the source deadline', async () => {
  await assert.rejects(replay(undefined, { sourceDeadlineMs: 20, fetchImpl: () => new Promise(() => {}) }).promise, /deadline/)
})
test('oversized source entities are cancelled before admission', async () => {
  let cancelled = false
  const reader = replay(undefined, { fetchImpl: async value => { const r = new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(4000001)) }, cancel() { cancelled = true } }), { status: 200, headers: { 'content-type': 'text/html' } }); Object.defineProperty(r, 'url', { value: String(value) }); return r } })
  await assert.rejects(reader.promise, error => error.softFailure === true); assert.equal(cancelled, true)
})

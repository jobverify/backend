import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'

const directory = new URL('./test-data-20261106/', import.meta.url)
const profile = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'))
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => [name, canonical(item)])) : value
const key = (url, init) => (init.method || 'GET') + ':' + url + ':' + (init.body ? JSON.stringify(canonical(JSON.parse(init.body))) : '')
const groups = new Map()
for (const row of profile.requests) {
  const identity = key(row.url, row)
  if (!groups.has(identity)) groups.set(identity, [])
  groups.get(identity).push(row)
}
const observations = jobs => jobs[Symbol.for('jobverify.verified-recruitment-observations')]
const registered = () => createCatalogScraper(getScraperCatalog().find(row => row.source === 'moodyscorporation'))
const replay = change => {
  const counts = new Map()
  const fetchFixture = async (url, init = {}) => {
    const identity = key(url, init), count = (counts.get(identity) || 0) + 1
    counts.set(identity, count)
    const rows = groups.get(identity)
    assert.ok(rows?.[count - 1], 'Uncaptured exact native request: ' + identity)
    const row = rows[count - 1]
    const original = gunzipSync(readFileSync(new URL(row.bodySHA256 + '.gz', directory)))
    assert.equal(createHash('sha256').update(original).digest('hex'), row.bodySHA256)
    if (row.status === 301 && init.redirect !== 'manual') {
      return fetchFixture(new URL(row.location, url).href, init)
    }
    const body = change?.(original.toString(), row, count) ?? original
    const response = new Response(body, { status: row.status, headers: {
      'content-type': row.contentType, ...(row.location ? { location: row.location } : {}) } })
    Object.defineProperty(response, 'url', { value: row.finalURL })
    return response
  }
  return fetchFixture
}
const read = change => registered().run({ fetchImpl: replay(change), now: () => '2026-11-06T18:30:00.000Z' })
const firstRole = '/en/job/gurugram/financial-data-specialist/49841/102938005008'
const mutatePosting = (body, change) => body.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
  (whole, start, raw, end) => {
    const value = JSON.parse(raw)
    if (value['@type'] !== 'JobPosting') return whole
    change(value)
    return start + JSON.stringify(value) + end
  })

test("Moody's registered source reconciles all 44 current native India roles and their full closing criteria", async () => {
  const jobs = await read()
  assert.equal(jobs.length, 44)
  assert.deepEqual(jobs.map(row => row.jobId).sort(), [...profile.expectedIndiaIds].sort())
  assert.deepEqual(jobs.map(row => row.nativeTalentbrewEvidence.publishedId).sort(), [...profile.expectedPublishedIds].sort())
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.nativeHiringOrganization.name, "Moody's")
    assert.equal(job.sourceDescription, job.nativeSourceRecord.description)
    assert.equal(job.sourceDescription, job.nativeClosingSourceRecord.description)
    assert.equal(job.nativeTalentbrewEvidence.roleClosingConfirmed, true)
    assert.equal(job.nativeTalentbrewEvidence.listingClosingConfirmed, true)
    assert.equal(job.nativeTalentbrewEvidence.fullCriteriaVisibleExact, true)
    assert.match(job.nativeTalentbrewEvidence.fullCriteriaSHA256, /^[a-f0-9]{64}$/)
    assert.equal(job.nativeTalentbrewEvidence.applicationContext.employerAccount, 'MoodysProd')
    assert.equal(job.nativeTalentbrewEvidence.applicationContext.nativeSchemaIdentifier, job.jobId)
    assert.equal(job.nativeTalentbrewEvidence.applicationContext.visited, false)
    assert.equal(job.nativeTalentbrewEvidence.applicationContext.acceptingApplicationsVerified, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited, false)
  }
  assert.equal(observations(jobs).nativeRecords, 44)
  assert.equal(observations(jobs).requestCount, 104)
  assert.equal(observations(jobs).receipts.filter(row => row.status === 200).length, 102)
  assert.equal(observations(jobs).receipts.filter(row => row.status === 301).length, 2)
  assert.equal(observations(jobs).nativeInventoryReads[0].reportedTotal, 44)
  assert.equal(observations(jobs).nativeInventoryReads[0].pages, 3)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test("Moody's withholds foreign typed role countries despite the native India filter", async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole) ? mutatePosting(body, posting => {
    for (const place of posting.jobLocation) place.address.addressCountry = 'United States'
  }) : body)
  assert.equal(jobs.length, 43)
  assert.ok(jobs.every(row => row.jobId !== '15909'))
})

test("Moody's withholds a foreign employer on its own published role URL", async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole)
    ? mutatePosting(body, posting => { posting.hiringOrganization.name = 'Unrelated Employer' }) : body)
  assert.equal(jobs.length, 43)
  assert.ok(jobs.every(row => row.jobId !== '15909'))
})

test("Moody's withholds a visibly filled native role despite unchanged structured posting data", async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole)
    ? body + '<p>This position has been filled.</p>' : body)
  assert.equal(jobs.length, 43)
  assert.ok(jobs.every(row => row.jobId !== '15909'))
})

test("Moody's cannot qualify full criteria from an inert native page", async () => {
  await assert.rejects(read((body, row) => row.url.endsWith(firstRole)
    ? '<template>' + body + '</template>' : body), /own full native role/i)
})

test("Moody's rejects hidden middle criteria even when the structured description prefix remains visible", async () => {
  await assert.rejects(read((body, row) => {
    if (!row.url.endsWith(firstRole)) return body
    let paragraphs = 0
    return body.replace(/(<div\s+class="ats-description"[^>]*>)([\s\S]*?)(<\/div>)/i, (_, start, content, end) => {
      const changed = content.replace(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi, paragraph => ++paragraphs === 3
        ? paragraph.replace('<p', '<p hidden') : paragraph)
      assert.ok(paragraphs >= 3, 'Actual role must contain the targeted middle paragraph')
      return start + changed + end
    })
  }), /criteria|description/i)
})

test("Moody's rejects an own-role application context that switches its employer account", async () => {
  await assert.rejects(read((body, row) => row.url.endsWith(firstRole)
    ? body.replaceAll('company=MoodysProd', 'company=UnrelatedEmployer') : body), /application|account|handoff/i)
})

test("Moody's rejects a closing full native role whose original criteria changed", async () => {
  await assert.rejects(read((body, row, count) => row.url.endsWith(firstRole) && count === 2
    ? mutatePosting(body, posting => { posting.description += '<p>Changed closing criteria.</p>' }) : body), /closing.*role|role.*changed/i)
})

test("Moody's rejects a changed closing native selected total", async () => {
  await assert.rejects(read((body, row, count) => {
    if (row.method !== 'POST' || JSON.parse(row.body).CurrentPage !== 1 || count !== 2) return body
    const value = JSON.parse(body)
    value.results = value.results.replaceAll('data-total-results="44"', 'data-total-results="45"')
    return JSON.stringify(value)
  }), /total|pagination|closing/i)
})

test("Moody's rejects a new native search client rather than interpreting an unreviewed contract", async () => {
  await assert.rejects(read((body, row) => row.url === 'https://tbcdn.talentbrew.com/js/client/search.js'
    ? body + '\n/* changed current client */' : body), /client|renderer/i)
})

test("Moody's rejects duplicate native publication identities before reading unrelated roles", async () => {
  await assert.rejects(read((body, row) => row.method === 'POST' && JSON.parse(row.body).CurrentPage === 1
    ? body.replaceAll('102455322976', '102938005008') : body), /duplicate|identity/i)
})

test("Moody's rejects a template-only corporate hiring handoff", async () => {
  await assert.rejects(read((body, row) => row.url === 'https://www.moodys.com/' ? '<template>' + body + '</template>' : body), /publisher|handoff|corporate/i)
})

test("Moody's discards the cohort if its corporate hiring handoff changes on closing", async () => {
  await assert.rejects(read((body, row, count) => row.url === 'https://www.moodys.com/' && count === 2
    ? body.replaceAll('https://careers.moodys.com/', 'https://unrelated.example/') : body), /publisher|handoff|binding/i)
})

test("Moody's honors caller cancellation before any public request", async () => {
  const reason = new Error('cancel native Moody extraction'), controller = new AbortController()
  controller.abort(reason)
  let calls = 0
  await assert.rejects(registered().run({ signal: controller.signal, fetchImpl: async () => { calls++ } }), error => error === reason)
  assert.equal(calls, 0)
})

for (const phase of ['headers', 'body', 'cleanup']) {
  test(`Moody's enforces exact caller cancellation during pending ${phase} even when transport ignores its signal`, async () => {
    const reason = Symbol('opaque caller cancellation during ' + phase), controller = new AbortController()
    let release, enter, deadline
    const pending = new Promise(resolve => { release = resolve })
    const entered = new Promise(resolve => { enter = resolve })
    const fixture = replay()
    const run = registered().run({ signal: controller.signal, fetchImpl: async (url, init) => {
      if (phase === 'headers') { enter(); await pending; return fixture(url, init) }
      return { status: 200, url, headers: new Headers({ 'content-type': 'text/html' }), body: { getReader: () => ({
        read: async () => { if (phase === 'body') { enter(); await pending }; return { done: true } },
        cancel: () => {
          if (phase === 'cleanup') { enter(); controller.abort(reason); return pending }
          return Promise.resolve()
        },
        releaseLock() {},
      }) } }
    } }).then(value => ({ value }), error => ({ error }))
    try {
      await entered
      if (phase !== 'cleanup') controller.abort(reason)
      const outcome = await Promise.race([run, new Promise(resolve => { deadline = setTimeout(() => resolve({ pending: true }), 250) })])
      assert.equal(outcome.pending, undefined, 'Run must reject without waiting for the uncooperative callback')
      assert.equal(outcome.error, reason, 'Exact opaque caller reason must survive header/body/cleanup cancellation')
    } finally { clearTimeout(deadline); release(); await run }
  })
}

for (const phase of ['headers', 'body']) {
  test(`Moody's aggregate deadline bounds pending ${phase} without caller cancellation`, async () => {
    let release, deadline
    const pending = new Promise(resolve => { release = resolve })
    const run = registered().run({ sourceTimeoutMs: 30, fetchImpl: async url => {
      if (phase === 'headers') return pending
      return { status: 200, url, headers: new Headers(), body: { getReader: () => ({
        read: () => pending, cancel: () => Promise.resolve(), releaseLock() {},
      }) } }
    } }).then(value => ({ value }), error => ({ error }))
    try {
      const outcome = await Promise.race([run, new Promise(resolve => { deadline = setTimeout(() => resolve({ pending: true }), 250) })])
      assert.equal(outcome.pending, undefined, 'Aggregate deadline must not depend on transport cooperation')
      assert.equal(outcome.error?.name, 'TimeoutError')
    } finally { clearTimeout(deadline); release({ done: true }); await run }
  })
}

test("Moody's retains a primary HTTP403 denial and safe native response provenance without publishing inventory", async () => {
  // A controlled denial, not a purported retained public HTTP capture.
  const body = 'Synthetic denial body: private-marker-must-not-be-exposed', calls = []
  let failure
  try {
    await registered().run({ fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method || 'GET' })
      const response = new Response(body, { status: 403, headers: {
        'content-type': 'text/plain; token=private-mime-parameter', 'set-cookie': 'private-test-cookie', 'x-private-test': 'private-test-header',
      } })
      Object.defineProperty(response, 'url', { value: url + '?token=private-query-marker#private-fragment-marker' })
      return response
    } })
    assert.fail('Denied native source must not return an inventory')
  } catch (error) { failure = error }
  assert.equal(failure.status, 403)
  assert.equal(failure.cause.status, 403)
  assert.match(failure.message, /HTTP\s*403/i)
  assert.deepEqual(classifyScraperError(failure), { softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied' })
  assert.deepEqual(calls, [{ url: 'https://www.moodys.com/', method: 'GET' }])
  assert.equal(failure.abortRetries, true)
  assert.equal(failure.lifecycleCleanupAllowed, false)
  const observations = failure.recruitmentObservations
  assert.equal(observations.source, 'moodyscorporation')
  assert.equal(observations.requestCount, 1)
  assert.equal(observations.nativeRecords, 0)
  assert.equal(observations.returnedIndiaJobs, 0)
  assert.equal(observations.sourceScopeComplete, false)
  assert.equal(observations.lifecycleCleanupAllowed, false)
  assert.equal(observations.receipts.length, 1)
  assert.deepEqual(observations.receipts[0], { requestedURL: 'https://www.moodys.com/', method: 'GET', status: 403,
    finalURL: 'https://www.moodys.com/', bodySHA256: createHash('sha256').update(body).digest('hex'),
    bodyBytes: Buffer.byteLength(body), contentType: 'text/plain' })
  assert.equal(observations.failures[0].status, 403)
  assert.doesNotMatch(JSON.stringify({ message: failure.message, ...failure }), /private-marker|private-test-cookie|private-test-header|private-mime-parameter|private-query-marker|private-fragment-marker/)
})

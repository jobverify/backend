import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'

const directory = new URL('./test-data-20261107/', import.meta.url)
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
const registered = () => createCatalogScraper(getScraperCatalog().find(row => row.source === 'synchronyfinancial'))
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
const firstRole = '/job/telangana/avp-software-engineering-lead-l10/49398/102799455776'
const mutatePosting = (body, change) => body.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
  (whole, start, raw, end) => {
    const value = JSON.parse(raw)
    if (value['@type'] !== 'JobPosting') return whole
    change(value)
    return start + JSON.stringify(value) + end
  })

test("Synchrony registered source reconciles all 15 current native India roles and their full closing criteria", async () => {
  const jobs = await read()
  assert.equal(jobs.length, 15)
  assert.deepEqual(jobs.map(row => row.jobId).sort(), [...profile.expectedIndiaIds].sort())
  assert.deepEqual(jobs.map(row => row.nativeTalentbrewEvidence.publishedId).sort(), [...profile.expectedPublishedIds].sort())
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.nativeHiringOrganization.name, "Synchrony Financial")
    assert.equal(job.sourceDescription, job.nativeSourceRecord.description)
    assert.equal(job.sourceDescription, job.nativeClosingSourceRecord.description)
    assert.equal(job.nativeTalentbrewEvidence.roleClosingConfirmed, true)
    assert.equal(job.nativeTalentbrewEvidence.listingClosingConfirmed, true)
    assert.equal(job.nativeTalentbrewEvidence.fullCriteriaVisibleExact, true)
    assert.match(job.nativeTalentbrewEvidence.fullCriteriaSHA256, /^[a-f0-9]{64}$/)
    assert.equal(job.nativeTalentbrewEvidence.applicationContext.employerAccount, 'synchronyfinancial/careers')
    assert.equal(job.nativeTalentbrewEvidence.applicationContext.nativeSchemaIdentifier, job.jobId)
    assert.equal(job.nativeTalentbrewEvidence.applicationContext.visited, false)
    assert.equal(job.nativeTalentbrewEvidence.applicationContext.acceptingApplicationsVerified, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited, false)
  }
  assert.equal(observations(jobs).nativeRecords, 15)
  assert.equal(observations(jobs).requestCount, 38)
  assert.equal(observations(jobs).receipts.filter(row => row.status === 200).length, 38)
  assert.equal(observations(jobs).receipts.filter(row => row.status === 301).length, 0)
  assert.equal(observations(jobs).nativeInventoryReads[0].reportedTotal, 15)
  assert.equal(observations(jobs).nativeInventoryReads[0].pages, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test("Synchrony withholds foreign typed role countries despite the native India filter", async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole) ? mutatePosting(body, posting => {
    for (const place of posting.jobLocation) place.address.addressCountry = 'United States'
  }) : body)
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(row => row.jobId !== '2602995'))
})

test("Synchrony withholds a foreign employer on its own published role URL", async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole)
    ? mutatePosting(body, posting => { posting.hiringOrganization.name = 'Unrelated Employer' }) : body)
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(row => row.jobId !== '2602995'))
})

test("Synchrony withholds a visibly filled native role despite unchanged structured posting data", async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole)
    ? body.replace(/(<div\s+class="[^"]*\bats-description\b[^"]*"[^>]*>)/i, '<p>This position has been filled.</p>$1') : body)
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(row => row.jobId !== '2602995'))
})

test("Synchrony cannot qualify full criteria from an inert native page", async () => {
  await assert.rejects(read((body, row) => row.url.endsWith(firstRole)
    ? '<template>' + body + '</template>' : body), /own full native role/i)
})

test("Synchrony rejects hidden middle criteria even when the structured description prefix remains visible", async () => {
  await assert.rejects(read((body, row) => {
    if (!row.url.endsWith(firstRole)) return body
    let paragraphs = 0, hiddenCriteria = false
    return body.replace(/(<div\s+class="[^"\n]*\bats-description\b[^"\n]*"[^>]*>)([\s\S]*?)(<\/div>)/i, (_, start, content, end) => {
      const changed = content.replace(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi, paragraph => {
        paragraphs++
        if (!hiddenCriteria && paragraph.replace(/<[^>]+>/g, '').trim().length > 150 && paragraphs > 3) {
          hiddenCriteria = true; return paragraph.replace('<p', '<p hidden')
        }
        return paragraph
      })
      assert.ok(hiddenCriteria, 'Actual role must contain a substantial targeted middle paragraph')
      return start + changed + end
    })
  }), /criteria|description/i)
})

test("Synchrony rejects an own-role application context that switches its employer account", async () => {
  await assert.rejects(read((body, row) => row.url.endsWith(firstRole)
    ? body.replaceAll('synchronyfinancial.wd5.myworkdayjobs.com', 'unrelated.wd5.myworkdayjobs.com') : body), /application|account|handoff/i)
})

test("Synchrony rejects a closing full native role whose original criteria changed", async () => {
  await assert.rejects(read((body, row, count) => row.url.endsWith(firstRole) && count === 2
    ? mutatePosting(body, posting => { posting.description += '<p>Changed closing criteria.</p>' }) : body), /closing.*role|role.*changed/i)
})

test("Synchrony rejects a changed closing native selected total", async () => {
  await assert.rejects(read((body, row, count) => {
    if (row.method !== 'POST' || JSON.parse(row.body).CurrentPage !== 1 || count !== 2) return body
    const value = JSON.parse(body)
    value.results = value.results.replaceAll('data-total-results="15"', 'data-total-results="45"')
    return JSON.stringify(value)
  }), /total|pagination|closing/i)
})

test("Synchrony rejects a new native search client rather than interpreting an unreviewed contract", async () => {
  await assert.rejects(read((body, row) => row.url === 'https://tbcdn.talentbrew.com/js/client/search.js'
    ? body + '\n/* changed current client */' : body), /client|renderer/i)
})

test("Synchrony rejects duplicate native publication identities before reading unrelated roles", async () => {
  await assert.rejects(read((body, row) => row.method === 'POST' && JSON.parse(row.body).CurrentPage === 1
    ? body.replaceAll('102921862000', '102799455776') : body), /duplicate|identity/i)
})

test("Synchrony rejects a template-only corporate hiring handoff", async () => {
  await assert.rejects(read((body, row) => row.url === 'https://www.synchronycareers.com/' ? '<template>' + body + '</template>' : body), /publisher|handoff|corporate/i)
})

test("Synchrony discards the cohort if its corporate hiring handoff changes on closing", async () => {
  await assert.rejects(read((body, row, count) => row.url === 'https://www.synchronycareers.com/' && count === 2
    ? body.replaceAll('href="/search-jobs"', 'href="https://unrelated.example/"') : body), /publisher|handoff|binding/i)
})

test("Synchrony honors caller cancellation before any public request", async () => {
  const reason = new Error('cancel native Synchrony extraction'), controller = new AbortController()
  controller.abort(reason)
  let calls = 0
  await assert.rejects(registered().run({ signal: controller.signal, fetchImpl: async () => { calls++ } }), error => error === reason)
  assert.equal(calls, 0)
})

for (const phase of ['headers', 'body', 'cleanup']) {
  test(`Synchrony enforces exact caller cancellation during pending ${phase} even when transport ignores its signal`, async () => {
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
  test(`Synchrony aggregate deadline bounds pending ${phase} without caller cancellation`, async () => {
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

test("Synchrony retains a primary HTTP403 denial and safe native response provenance without publishing inventory", async () => {
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
  assert.deepEqual(calls, [{ url: 'https://www.synchronycareers.com/', method: 'GET' }])
  assert.equal(failure.abortRetries, true)
  assert.equal(failure.lifecycleCleanupAllowed, false)
  const observations = failure.recruitmentObservations
  assert.equal(observations.source, 'synchronyfinancial')
  assert.equal(observations.requestCount, 1)
  assert.equal(observations.nativeRecords, 0)
  assert.equal(observations.returnedIndiaJobs, 0)
  assert.equal(observations.sourceScopeComplete, false)
  assert.equal(observations.lifecycleCleanupAllowed, false)
  assert.equal(observations.receipts.length, 1)
  assert.deepEqual(observations.receipts[0], { requestedURL: 'https://www.synchronycareers.com/', method: 'GET', status: 403,
    finalURL: 'https://www.synchronycareers.com/', bodySHA256: createHash('sha256').update(body).digest('hex'),
    bodyBytes: Buffer.byteLength(body), contentType: 'text/plain' })
  assert.equal(observations.failures[0].status, 403)
  assert.doesNotMatch(JSON.stringify({ message: failure.message, ...failure }), /private-marker|private-test-cookie|private-test-header|private-mime-parameter|private-query-marker|private-fragment-marker/)
})

for (const state of ['This position is on hold.', 'Hiring for this position is paused.']) {
  test('Synchrony withholds an explicitly held native role and retains its raw audit: ' + state, async () => {
    const jobs = await read((body, row) => row.url.endsWith(firstRole)
      ? body.replace(/(<div\s+class="[^"]*\bats-description\b[^"]*"[^>]*>)/i, '<p>' + state + '</p>$1') : body)
    assert.equal(jobs.length, 14)
    assert.ok(jobs.every(job => job.jobId !== '2602995'))
    const exclusion = observations(jobs).exclusions.find(row => row.nativeSourceRecord.identifier.value === '2602995')
    assert.equal(exclusion.reason, 'native-role-on-hold')
    assert.match(exclusion.openingNativeRoleHTML, /Hiring for this position is paused|This position is on hold/)
    assert.match(exclusion.closingNativeRoleHTML, /Hiring for this position is paused|This position is on hold/)
    assert.equal(exclusion.nativeClosingSourceRecord.description, exclusion.nativeSourceRecord.description)
  })
}

for (const employer of ['Synchrony Financial Inc.', 'Synchrony International Services Private Limited', '']) {
  test('Synchrony requires its exact configured native employer, without applying an unreviewed alias: ' + employer, async () => {
    const jobs = await read((body, row) => row.url.endsWith(firstRole)
      ? mutatePosting(body, posting => { posting.hiringOrganization.name = employer }) : body)
    assert.equal(jobs.length, 14)
    assert.ok(jobs.every(job => job.jobId !== '2602995'))
  })
}

test('Synchrony cannot infer India from an India facet, a city, or a blank typed country', async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole) ? mutatePosting(body, posting => {
    for (const place of posting.jobLocation) place.address.addressCountry = ''
  }) : body)
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(job => job.jobId !== '2602995'))
})

test('Synchrony withholds an expired native closing date', async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole)
    ? mutatePosting(body, posting => { posting.validThrough = '2026-11-01' }) : body)
  assert.equal(jobs.length, 14)
})

test('Synchrony rejects a new role-owned hold appearing only on closing', async () => {
  await assert.rejects(read((body, row, count) => row.url.endsWith(firstRole) && count === 2
    ? body.replace(/(<div\s+class="[^"]*\bats-description\b[^"]*"[^>]*>)/i, '<p>This position is on hold.</p>$1') : body), /closing.*changed/i)
})

for (const phrase of ['This position is not on hold.', 'This position remains unfilled.', 'This position has not been filled.']) {
  test('Synchrony retains an active native role with a negated closed/held statement: ' + phrase, async () => {
    const jobs = await read((body, row) => row.url.endsWith(firstRole)
      ? body.replace(/(<div\s+class="[^"]*\bats-description\b[^"]*"[^>]*>)/i, '<p>' + phrase + '</p>$1') : body)
    assert.equal(jobs.length, 15)
  })
}

for (const sourceTimeoutMs of [0, -1, 180001, Number.NaN]) {
  test('Synchrony refuses an invalid/unbounded aggregate timeout before a request: ' + sourceTimeoutMs, async () => {
    let calls = 0
    await assert.rejects(registered().run({ sourceTimeoutMs, fetchImpl: async () => { calls++; throw Error('must not fetch') } }), /timeout.*bound|bound.*timeout/i)
    assert.equal(calls, 0)
  })
}

test('Synchrony does not treat unrelated outside-role prose as this role closure', async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole)
    ? body + '<footer><p>This position has been filled.</p></footer>' : body)
  assert.equal(jobs.length, 15)
})

test('Synchrony does not treat a company-overview narrative about an earlier position as this role closure', async () => {
  const narrative = '<p>Company Overview: An earlier position has been filled; this role is accepting applications.</p>'
  const jobs = await read((body, row) => row.url.endsWith(firstRole)
    ? mutatePosting(body.replace(/(<div\s+class="[^"]*\bats-description\b[^"]*"[^>]*>)/i, '$1' + narrative), posting => { posting.description = narrative + posting.description }) : body)
  assert.equal(jobs.length, 15)
})

for (const addressCountry of ['United States', '']) {
  test('Synchrony withholds a new additional country carrier that does not explicitly qualify India: ' + addressCountry, async () => {
    const jobs = await read((body, row) => row.url.endsWith(firstRole) ? mutatePosting(body, posting => {
      posting.jobLocation.push({ '@type': 'Place', address: { addressCountry, addressLocality: 'Hyderabad' } })
    }) : body)
    assert.equal(jobs.length, 14)
  })
}

test('Synchrony rejects contradictory labels within one typed country', async () => {
  await assert.rejects(read((body, row) => row.url.endsWith(firstRole) ? mutatePosting(body, posting => {
    posting.jobLocation[0].address.addressCountry = { name: 'India', alpha2Code: 'US' }
  }) : body), /contradictory.*country/i)
})

for (const [field, value] of [['applicantLocationRequirements', { name: 'United States' }], ['isActive', false], ['@id', 'https://unrelated.example/job']]) {
  test('Synchrony rejects an additional unreviewed native authority/lifecycle carrier: ' + field, async () => {
    await assert.rejects(read((body, row) => row.url.endsWith(firstRole) ? mutatePosting(body, posting => { posting[field] = value }) : body), /authority|lifecycle|carrier/i)
  })
}

for (const [field, value] of [['datePosted', '2026-02-30'], ['datePosted', '2026-11-06T10:00:00Z'], ['validThrough', '2026-02-30']]) {
  test('Synchrony rejects an invalid/unreviewed native calendar date: ' + field + '=' + value, async () => {
    await assert.rejects(read((body, row) => row.url.endsWith(firstRole) ? mutatePosting(body, posting => { posting[field] = value }) : body), /calendar|posting date|closing date/i)
  })
}

const nestedAuthorityCases = [
  ['additional-addressless-place', posting => { posting.jobLocation.push({ '@type': 'Place', name: 'United States' }) }],
  ['country-object-unreviewed-countryCode', posting => { posting.jobLocation[0].address.addressCountry = { name: 'India', countryCode: 'US' } }],
  ['country-object-unknown-alpha2Code', posting => { posting.jobLocation[0].address.addressCountry = { name: 'India', alpha2Code: 'ZZ' } }],
  ['address-level-foreign-country', posting => { posting.jobLocation[0].address.country = 'United States' }],
  ['country-object-unreviewed-identifier', posting => { posting.jobLocation[0].address.addressCountry = { name: 'India', identifier: 'US' } }],
  ['country-object-unknown-descriptor', posting => { posting.jobLocation[0].address.addressCountry = { name: 'India', descriptor: 'UnreviewedCountry' } }],
  ['place-level-countryCode', posting => { posting.jobLocation[0].countryCode = 'US' }],
  ['place-level-addressCountry', posting => { posting.jobLocation[0].addressCountry = 'United States' }],
  ['address-level-countryCode', posting => { posting.jobLocation[0].address.countryCode = 'US' }],
  ['organization-foreign-url', posting => { posting.hiringOrganization.url = 'https://unrelated.invalid/company' }],
  ['null-additional-place', posting => { posting.jobLocation.push(null) }],
  ['place-null-address', posting => { posting.jobLocation.push({ '@type': 'Place', address: null }) }],
  ['address-array-carrier', posting => { posting.jobLocation[0].address = [posting.jobLocation[0].address] }],
  ['country-multiple-label-array', posting => { posting.jobLocation[0].address.addressCountry = ['India', 'United States'] }],
  ['country-object-nonstring-alpha2Code', posting => { posting.jobLocation[0].address.addressCountry = { name: 'India', alpha2Code: ['US'] } }],
  ['country-object-unreviewed-alternateName', posting => { posting.jobLocation[0].address.addressCountry = { name: 'India', alternateName: 'US' } }],
  ['address-noncoercible-locality-carrier', posting => { posting.jobLocation[0].address.addressLocality = { toString: 'United States', valueOf: 'United States' } }],
  ['address-nonstring-locality-carrier', posting => { posting.jobLocation[0].address.addressLocality = { country: 'US' } }],
  ['organization-unreviewed-parent', posting => { posting.hiringOrganization.parentOrganization = { name: 'Unrelated Employer' } }],
  ['organization-foreign-sameAs', posting => { posting.hiringOrganization.sameAs = 'https://unrelated.invalid/company' }],
]
for (const [name, mutate] of nestedAuthorityCases) {
  test('Synchrony review nested authority holds unsupported raw evidence: ' + name, async () => {
    const jobs = await read((body, row) => row.url.endsWith(firstRole) ? mutatePosting(body, mutate) : body)
    assert.equal(jobs.length, 14)
    assert.ok(jobs.every(job => job.jobId !== '2602995'))
    const exclusion = observations(jobs).exclusions.find(row => row.nativeSourceRecord.identifier.value === '2602995')
    assert.ok(exclusion, 'Unsupported native role remains in the raw exclusion audit')
    assert.match(exclusion.reason, /authority-unqualified/)
    assert.ok(exclusion.observations.qualificationIssues.length > 0)
    assert.deepEqual(exclusion.nativeSourceRecord, exclusion.nativeClosingSourceRecord)
    assert.match(exclusion.openingNativeRoleHTML, /2602995/)
    assert.match(exclusion.closingNativeRoleHTML, /2602995/)
    assert.equal(jobs.every(job => job.lifecycleCleanupAllowed === false && job.sourceScopeComplete === false), true)
  })
}

test('Synchrony preserves genuine empty optional address fields and empty authority fields without inferring a country', async () => {
  const jobs = await read((body, row) => row.url.endsWith(firstRole) ? mutatePosting(body, posting => {
    posting.jobLocation[0].name = ''
    posting.jobLocation[0].address.country = null
    posting.jobLocation[0].address.countryCode = ''
    posting.hiringOrganization.url = ''
    posting.hiringOrganization.sameAs = []
  }) : body)
  assert.equal(jobs.length, 15)
  const job = jobs.find(row => row.jobId === '2602995')
  assert.equal(job.nativeSourceRecord.jobLocation[0].address.addressCountry, 'IN')
  assert.equal(job.nativeSourceRecord.jobLocation[0].address.country, null)
  assert.equal(job.nativeSourceRecord.jobLocation[0].address.countryCode, '')
  assert.equal(job.nativeHiringOrganization.url, '')
  assert.deepEqual(job.nativeHiringOrganization.sameAs, [])
  assert.deepEqual(job.nativeClosingSourceRecord, job.nativeSourceRecord)
})

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { extractSearchResults, extractJobDetail, createOptumScraper, CAREER_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-current-20261107.json.gz', import.meta.url))))
const firstPage = fixture.listings[0], secondPage = fixture.listings[1], detail = fixture.detail
// Hand-checked public fields keep detail tests independent of the listing
// parser, so a parser failure cannot stand in for the guard under test.
const firstListing = () => ({ title: 'Data Engineering Lead', company: 'Optum',
  jobId: '102958124464', requisitionId: '2396958', nativeBrand: 'Optum',
  nativeBrandClass: 'brand-facet__optum', country: null, location: 'Bengaluru, Karnataka',
  sourceUrl: 'https://careers.unitedhealthgroup.com/job/bengaluru/data-engineering-lead/34088/102958124464' })
const alterModel = change => {
  const model = structuredClone(fixture.nativeModel); change(model)
  return detail.body.replace(/(<script\s+type="application\/ld\+json">)([\s\S]*?)(<\/script>)/i,
    (_all, open, _body, close) => open + JSON.stringify(model) + close)
}
const getPage = async url => {
  if (url === firstPage.requestUrl) return { ...firstPage, html: firstPage.body }
  if (url === secondPage.requestUrl) return { ...secondPage, html: secondPage.body }
  if (url === detail.requestUrl) return { ...detail, html: detail.body }
  throw new Error('Unrecorded public fixture URL ' + url)
}
const replay = fetchPage => ({ fetchPage, fetchText: async url => (await fetchPage(url)).html })

test('Optum reads the current attribute order and explicit brand anchors without inventing country from the India search', () => {
  const rows = extractSearchResults(firstPage.body)
  assert.equal(rows.length, 15)
  assert.equal(rows[0].title, 'Data Engineering Lead')
  assert.equal(rows[0].jobId, '102958124464')
  assert.equal(rows[0].requisitionId, '2396958')
  assert.equal(rows[0].nativeBrand, 'Optum')
  assert.equal(rows[0].country, null)
  assert.equal(rows[0].sourceUrl, 'https://careers.unitedhealthgroup.com/job/bengaluru/data-engineering-lead/34088/102958124464')
})

test('Optum excludes another native group brand even when its title and India search location look suitable', () => {
  const rows = extractSearchResults(firstPage.body.replace('brand-facet__optum', 'brand-facet__unitedhealthcare'))
  assert.equal(rows.length, 14)
  assert.equal(rows.some(row => row.jobId === '102958124464'), false)
})

test('Optum preserves the full native criteria, formal identifier, country and parent employer provenance', () => {
  const listing = firstListing()
  assert.ok(listing, 'Current native Optum listing must be extracted before its detail is attributed')
  const job = extractJobDetail(detail.body, listing)
  assert.equal(job.company, 'Optum')
  assert.equal(job.nativeEmployer, 'UnitedHealth Group')
  assert.equal(job.requisitionId, '2396958')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bangalore')
  assert.equal(job.postingDate, '2026-11-06')
  assert.equal(job.postingDatePrecision, 'calendar-date')
  assert.equal(job.firstEverPostedAt, null)
  assert.equal(job.applyUrl, 'https://uhg.taleo.net/careersection/10780/jobapply.ftl?job=2396958')
  assert.equal(job.sourceDescription.length, 7392)
  assert.equal(createHash('sha256').update(job.sourceDescription).digest('hex'), '7435b07acf7b4ede4eb1893a97583c7008d3942b931047ce868146b87c200025')
  assert.match(job.jobDescription, /Familiarity with Healthcare business data models/)
  assert.deepEqual(job.nativeSourceRecord, fixture.nativeModel)
  assert.equal(job.applicationVisited, false)
})

test('Optum emits a bounded genuine role only after native detail and listing closing checks, with partial cleanup restrictions', async () => {
  const jobs = await createOptumScraper({ maxPages: 1, maxJobs: 1 }).run(replay(getPage))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].requisitionId, '2396958')
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(jobs[0].sourceDetailComplete, true)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  const observed = jobs[Symbol.for('jobverify.verified-recruitment-observations')]
  assert.equal(observed.reportedGroupSearchTotal, 202)
  assert.equal(observed.reportedGroupSearchPages, 14)
  assert.equal(observed.visitedListingPages, 1)
  assert.equal(observed.listingReconciled, true)
  assert.equal(observed.retainedNativeDetailsReconciled, true)
})

test('Optum cannot inherit India from the search when the native role country changed', () => {
  const listing = firstListing(); assert.ok(listing)
  const html = alterModel(model => { model.jobLocation[0].address.addressCountry = 'United States' })
  assert.throws(() => extractJobDetail(html, listing), /native.*India|country/i)
})

test('Optum rejects a native description that is unavailable instead of publishing a listing summary', () => {
  const listing = firstListing(); assert.ok(listing)
  assert.throws(() => extractJobDetail(alterModel(model => { model.description = '' }), listing), /description|criteria/i)
})

test('Optum rejects conflicting formal requisition identities', () => {
  const listing = firstListing(); assert.ok(listing)
  assert.throws(() => extractJobDetail(alterModel(model => { model.identifier.value = '9999999' }), listing), /requisition|identity/i)
})

test('Optum rejects a native employer that does not match its observed employer context', () => {
  const listing = firstListing(); assert.ok(listing)
  assert.throws(() => extractJobDetail(alterModel(model => { model.hiringOrganization.name = 'Unrelated Employer' }), listing), /employer/i)
})

test('Optum rejects a native page that repeats the previous page number before the advertised boundary', async () => {
  await assert.rejects(createOptumScraper({ maxPages: 2, maxJobs: 1 }).run(replay(async url => {
    if (url === secondPage.requestUrl) return { ...secondPage, html: secondPage.body.replace('data-current-page="2"', 'data-current-page="1"') }
    return getPage(url)
  })), /page|pagination/i)
})

test('Optum checks caller cancellation immediately after a public read', async () => {
  const controller = new AbortController(); let reads = 0
  await assert.rejects(createOptumScraper({ maxPages: 1, maxJobs: 1 }).run({ signal: controller.signal, ...replay(async url => {
    reads++; const page = await getPage(url); controller.abort(new Error('caller cancelled')); return page
  }) }), /caller cancelled/)
  assert.equal(reads, 1)
})

test('Optum rejects changed closing native criteria', async () => {
  let detailReads = 0
  await assert.rejects(createOptumScraper({ maxPages: 1, maxJobs: 1 }).run(replay(async url => {
    if (url === detail.requestUrl && ++detailReads > 1) return { ...detail, html: alterModel(model => { model.description = model.description.replace('Familiarity with Healthcare business data models', 'This requirement changed during collection') }) }
    return getPage(url)
  })), /closing|changed/i)
})

test('Optum honors a zero caller cap without observing or declaring an empty inventory', async () => {
  const jobs = await createOptumScraper({ maxJobs: 0 }).run(replay(async () => assert.fail('No public read is authorized by a zero caller cap')))
  assert.deepEqual([...jobs], [])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('Optum retains independent qualified roles while holding an actual native role without own-brand context', async () => {
  const jobs = await createOptumScraper({ maxPages: 1, maxJobs: 2 }).run(replay(async url => {
    if (url === CAREER_PAGE_URL) return { status: 200, url, headers: { 'content-type': 'text/html' }, html: fixture.twoRoleProjection.body }
    if (url === fixture.heldDetail.requestUrl) return { ...fixture.heldDetail, html: fixture.heldDetail.body }
    return getPage(url)
  }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].requisitionId, '2396958')
  const observation = jobs[Symbol.for('jobverify.verified-recruitment-observations')]
  assert.equal(observation.heldNativeRoles.length, 1)
  assert.equal(observation.heldNativeRoles[0].reason, 'native-Optum-brand-context-unavailable')
  assert.equal(observation.heldNativeRoles[0].sourceUrl, fixture.heldDetail.requestUrl)
  assert.deepEqual(observation.heldNativeRoles[0].nativeSourceRecord, fixture.heldNativeModel)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('Optum holds the actual country-incomplete native role without inheriting India or discarding an independent verified role', async () => {
  assert.equal(Object.hasOwn(fixture.countryHoldNativeModel, 'jobLocation'), false)
  const jobs = await createOptumScraper({ maxPages: 1, maxJobs: 2 }).run(replay(async url => {
    if (url === CAREER_PAGE_URL) return { status: 200, url, headers: { 'content-type': 'text/html' }, html: fixture.twoRoleCountryProjection.body }
    if (url === fixture.countryHoldDetail.requestUrl) return { ...fixture.countryHoldDetail, html: fixture.countryHoldDetail.body }
    return getPage(url)
  }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].requisitionId, '2396958')
  const held = jobs[Symbol.for('jobverify.verified-recruitment-observations')].heldNativeRoles
  assert.equal(held.length, 1)
  assert.equal(held[0].reason, 'native-India-country-unavailable')
  assert.equal(held[0].sourceUrl, fixture.countryHoldDetail.requestUrl)
  assert.deepEqual(held[0].nativeSourceRecord, fixture.countryHoldNativeModel)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

const unqualifiedCases = [
  ['criteria', 'full-native-criteria-unavailable', model => { model.description = '' }],
  ['employer', 'native-employer-context-unverified', model => { model.hiringOrganization.name = 'Unrelated Employer' }],
  ['formal requisition', 'native-listing-detail-identity-conflict', model => { model.identifier.value = '9999999' }],
  ['foreign country', 'native-country-outside-India', model => { model.jobLocation[0].address.addressCountry = 'United States' }],
  ['worksite', 'native-India-worksite-unavailable', model => { delete model.jobLocation[0].address.addressLocality }],
  ['publication date', 'native-publication-date-unavailable', model => { model.datePosted = 'invalid native date' }],
  ['application requisition', 'native-application-identity-unverified', () => {}, html => html.replaceAll('job=2397849', 'job=9999999')],
]
for (const [name, reason, change, changeHtml = html => html] of unqualifiedCases) {
  test('Optum holds an independently unqualified ' + name + ' without weakening its guard or dropping verified roles', async () => {
    const model = structuredClone(fixture.heldNativeModel); change(model)
    const html = changeHtml(fixture.heldDetail.body.replace(/(<script\s+type="application\/ld\+json">)([\s\S]*?)(<\/script>)/i,
      (_all, open, _body, close) => open + JSON.stringify(model) + close))
    const jobs = await createOptumScraper({ maxPages: 1, maxJobs: 2 }).run(replay(async url => {
      if (url === CAREER_PAGE_URL) return { status: 200, url, headers: { 'content-type': 'text/html' }, html: fixture.twoRoleProjection.body }
      if (url === fixture.heldDetail.requestUrl) return { ...fixture.heldDetail, html }
      return getPage(url)
    }))
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].requisitionId, '2396958')
    const held = jobs[Symbol.for('jobverify.verified-recruitment-observations')].heldNativeRoles
    assert.equal(held.length, 1)
    assert.equal(held[0].reason, reason)
    assert.deepEqual(held[0].nativeSourceRecord, model)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  })
}

test('Optum holds a single role with an ambiguous native detail model without publishing either candidate', async () => {
  const jobs = await createOptumScraper({ maxPages: 1, maxJobs: 2 }).run(replay(async url => {
    if (url === CAREER_PAGE_URL) return { status: 200, url, headers: { 'content-type': 'text/html' }, html: fixture.twoRoleProjection.body }
    if (url === fixture.heldDetail.requestUrl) return { ...fixture.heldDetail,
      html: fixture.heldDetail.body + '<script type="application/ld+json">' + JSON.stringify(fixture.heldNativeModel) + '</script>' }
    return getPage(url)
  }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].requisitionId, '2396958')
  const held = jobs[Symbol.for('jobverify.verified-recruitment-observations')].heldNativeRoles
  assert.equal(held.length, 1)
  assert.match(held[0].nativeDetailError.message, /model URL identity unavailable or ambiguous/)
})

test('Optum holds the actual malformed native role model with its exact public body and error while retaining a verified role', async () => {
  const jobs = await createOptumScraper({ maxPages: 1, maxJobs: 2 }).run(replay(async url => {
    if (url === CAREER_PAGE_URL) return { status: 200, url, headers: { 'content-type': 'text/html' }, html: fixture.twoRoleMalformedProjection.body }
    if (url === fixture.malformedDetail.requestUrl) return { ...fixture.malformedDetail, html: fixture.malformedDetail.body }
    return getPage(url)
  }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].requisitionId, '2396958')
  const held = jobs[Symbol.for('jobverify.verified-recruitment-observations')].heldNativeRoles
  assert.equal(held.length, 1)
  assert.equal(held[0].sourceUrl, fixture.malformedDetail.requestUrl)
  assert.equal(held[0].reason, 'native-role-detail-envelope-unqualified')
  assert.equal(held[0].nativeDetailBody, fixture.malformedDetail.body)
  assert.equal(held[0].detailBodySha256, fixture.malformedDetail.sha256)
  assert.match(held[0].nativeDetailError.message, /malformed native JobPosting/)
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('Optum still aborts a malformed shared listing envelope', async () => {
  await assert.rejects(createOptumScraper({ maxPages: 1, maxJobs: 1 }).run(replay(async url => {
    if (url === CAREER_PAGE_URL) return { ...firstPage, html: firstPage.body.replace('id="search-results-list"', 'id="unrecognized-results"') }
    return getPage(url)
  })), /listing section unavailable or ambiguous/)
})

test('Optum still propagates detail transport failure instead of holding it as native qualification evidence', async () => {
  await assert.rejects(createOptumScraper({ maxPages: 1, maxJobs: 1 }).run(replay(async url => {
    if (url === detail.requestUrl) throw new Error('public detail transport failure')
    return getPage(url)
  })), /public detail transport failure/)
})

for (const [label, validThrough] of [['past calendar day', '2026-11-06'], ['past exact instant', '2026-11-07T13:00:00Z'], ['exact boundary', '2026-11-07T14:00:00Z']]) {
  test('Optum holds a known-expired native ' + label + ' with its unchanged raw date', async () => {
    const html = alterModel(model => { model.validThrough = validThrough })
    const jobs = await createOptumScraper({ maxPages: 1, maxJobs: 1 }).run({ now: () => '2026-11-07T14:00:00Z', ...replay(async url =>
      url === detail.requestUrl ? { ...detail, html } : getPage(url)) })
    assert.equal(jobs.length, 0)
    const held = jobs[Symbol.for('jobverify.verified-recruitment-observations')].heldNativeRoles
    assert.equal(held.length, 1)
    assert.equal(held[0].reason, 'native-role-known-closed')
    assert.equal(held[0].nativeSourceRecord.validThrough, validThrough)
    assert.equal(held[0].nativeDetailBody, html)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  })
}

test('Optum keeps a native closing calendar day current through that day without inventing an exact instant', async () => {
  const html = alterModel(model => { model.validThrough = '2026-11-07' })
  const jobs = await createOptumScraper({ maxPages: 1, maxJobs: 1 }).run({ now: () => '2026-11-07T23:00:00Z', ...replay(async url =>
    url === detail.requestUrl ? { ...detail, html } : getPage(url)) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].closingDate, '2026-11-07')
  assert.equal(jobs[0].sourceClosingDateIsExact, false)
})

test('Optum cannot return a role whose exact native expiry passes during closing reconciliation', async () => {
  const html = alterModel(model => { model.validThrough = '2026-11-07T14:00:00Z' })
  let detailReads = 0, now = '2026-11-07T13:59:00Z'
  await assert.rejects(createOptumScraper({ maxPages: 1, maxJobs: 1 }).run({ now: () => now, ...replay(async url => {
    if (url === detail.requestUrl) { if (++detailReads > 1) now = '2026-11-07T14:01:00Z'; return { ...detail, html } }
    return getPage(url)
  }) }), /closing.*expir/i)
})

for (const [name, value] of [['sourceDeadlineMs', Infinity], ['sourceDeadlineMs', 0], ['maxPublicReads', Infinity], ['maxTotalResponseBytes', Infinity], ['detailConcurrency', Infinity], ['detailConcurrency', 0]]) {
  test('Optum rejects invalid or unbounded caller ' + name + '=' + value + ' before public reads', async () => {
    let reads = 0
    await assert.rejects(createOptumScraper({ maxPages: 1, maxJobs: 1 }).run({ [name]: value, ...replay(async url => { reads++; return getPage(url) }) }), /invalid/i)
    assert.equal(reads, 0)
  })
}

test('Optum bounds an oversized finite native page request and every opening/closing read', async () => {
  let reads = 0
  const firstAnchor = firstPage.body.match(/<a\b[^>]*data-job-id="102958124464"[^>]*>[\s\S]*?<\/a>/i)?.[0]
    || firstPage.body.match(/<a\b[^>]*data-job-id='102958124464'[^>]*>[\s\S]*?<\/a>/i)?.[0]
  assert.ok(firstAnchor)
  const jobs = await createOptumScraper({ maxPages: 1000000000 }).run(replay(async url => {
    if (++reads > 20) throw new Error('unbounded public listing reads escaped the hard source cap')
    const page = url === CAREER_PAGE_URL ? 1 : Number(url.split('/').pop())
    const anchor = firstAnchor.replaceAll('102958124464', String(900000000000 + page)).replace('brand-facet__optum', 'brand-facet__unitedhealthcare')
    return { status: 200, url, headers: { 'content-type': 'text/html' }, html: '<section id="search-results" data-current-page="' + page + '" data-total-pages="1000000" data-total-results="1000000" data-records-per-page="1"><section id="search-results-list">' + anchor + '</section><a class="next" href="' + CAREER_PAGE_URL + '/' + (page + 1) + '">Next</a></section>' }
  }))
  assert.equal(reads, 20)
  assert.equal(jobs.length, 0)
  assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].visitedListingPages, 10)
})

test('Optum enforces a caller-reduced public request budget outside the per-role hold boundary', async () => {
  let reads = 0
  await assert.rejects(createOptumScraper({ maxPages: 1, maxJobs: 1 }).run({ maxPublicReads: 1, ...replay(async url => { reads++; return getPage(url) }) }), /public-read-budget/i)
  assert.equal(reads, 1)
})

test('Optum enforces its aggregate response byte budget outside role qualification', async () => {
  let reads = 0
  await assert.rejects(createOptumScraper({ maxPages: 1, maxJobs: 1 }).run({ maxTotalResponseBytes: 64, ...replay(async url => { reads++; return getPage(url) }) }), /response-byte-budget/i)
  assert.equal(reads, 1)
})

test('Optum source deadline reaches active transport and is not held as a role absence', async () => {
  await assert.rejects(createOptumScraper({ maxPages: 1, maxJobs: 1 }).run({ sourceDeadlineMs: 5, fetchPage: async (_url, { signal } = {}) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('source deadline did not reach public transport')), 200)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  }) }), error => error.name === 'TimeoutError')
})

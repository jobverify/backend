import assert from 'node:assert/strict'
import test from 'node:test'
import { extractJobDetail, extractSearchResults, createIqviaScraper, buildListingUrl } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const detail = id => `<h1>Engineer</h1><dl><dt>Job ID</dt><dd>${id}</dd><dt>Location</dt><dd>Pune, Maharashtra, India</dd></dl><section class="job-description"><p>Maintain public data platforms.</p><h2>Required qualifications</h2><p>Three years of Python experience.</p><ul><li>SQL</li><li>Linux</li></ul><h2>Preferred qualifications</h2><p>Experience with scientific computing.</p></section>`
const listing = (start, end, id, location) => `<p class="results-count">Showing ${start}-${end} of 3 jobs</p><article class="job-card"><a class="job-title" href="/en/jobs/${id}">Engineer</a><p class="job-location">${location}</p></article>`

test('IQVIA retains all native description paragraphs and qualification lists', () => {
  const job = extractJobDetail(detail('R8000'), { sourceUrl: 'https://jobs.iqvia.com/en/jobs/R8000' })
  assert.equal(job.jobDescription, 'Maintain public data platforms. Required qualifications Three years of Python experience. SQL Linux Preferred qualifications Experience with scientific computing.')
})

test('IQVIA follows native result totals across a page with no India matches', async () => {
  const jobs = await createIqviaScraper().run({ fetchText: async url => {
    if (url === buildListingUrl(1)) return listing(1, 1, 'R8000', 'London, United Kingdom')
    if (url === buildListingUrl(2)) return listing(2, 2, 'R8001', 'Boston, United States')
    if (url === buildListingUrl(3)) return listing(3, 3, 'R8002', 'Pune, Maharashtra, India')
    if (url === 'https://jobs.iqvia.com/en/jobs/R8002') return detail('R8002')
    throw new Error('Unexpected public read ' + url)
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].requisitionId, 'R8002')
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('IQVIA respects caller cancellation before another listing read', async () => {
  const controller = new AbortController(); let reads = 0
  await assert.rejects(createIqviaScraper().run({ signal: controller.signal, fetchText: async () => {
    reads++; controller.abort(new Error('caller cancelled'))
    return listing(1, 1, 'R8000', 'London, United Kingdom')
  } }), /caller cancelled/)
  assert.equal(reads, 1)
})

test('IQVIA retains qualification content after a nested native description section', () => {
  const html = '<section class="job-description"><p>Maintain data platforms.</p><section><h2>Qualifications</h2><p>Degree in computer science.</p></section><h2>Required skills</h2><ul><li>SQL</li><li>Linux</li></ul></section>'
  const job = extractJobDetail(html)
  assert.equal(job.jobDescription, 'Maintain data platforms. Qualifications Degree in computer science. Required skills SQL Linux')
  assert.deepEqual(job.requiredSkills, ['SQL', 'Linux'])
})

test('IQVIA excludes inactive markup from native criteria and skill lists', () => {
  const html = '<section class="job-description"><p>Maintain data platforms.</p><template><p>Old Java requirement.</p><li>Java</li></template><p hidden>Expired vacancy qualifications.</p><p>Python experience required.</p><ul><li>SQL</li></ul></section>'
  const job = extractJobDetail(html)
  assert.equal(job.jobDescription, 'Maintain data platforms. Python experience required. SQL')
  assert.deepEqual(job.requiredSkills, ['SQL'])
})

test('IQVIA does not treat an India substring in a foreign native location as country proof', () => {
  assert.deepEqual(extractSearchResults(listing(1, 1, 'R8000', 'Indianapolis, Indiana, United States')), [])
})

test('IQVIA rejects a detail whose native requisition differs from the listing', async () => {
  await assert.rejects(createIqviaScraper().run({ fetchText: async url => url === buildListingUrl(1)
    ? listing(1, 1, 'R8000', 'Pune, Maharashtra, India').replace('of 3 jobs', 'of 1 jobs')
    : detail('R8001') }), /identity|requisition/i)
})

test('IQVIA does not emit an India summary without full native criteria', async () => {
  await assert.rejects(createIqviaScraper().run({ fetchText: async url => url === buildListingUrl(1)
    ? listing(1, 1, 'R8000', 'Pune, Maharashtra, India').replace('of 3 jobs', 'of 1 jobs')
    : '<h1>Engineer</h1><dl><dt>Job ID</dt><dd>R8000</dd><dt>Location</dt><dd>Pune, Maharashtra, India</dd></dl>' }), /description|criteria/i)
})

for (const maxPages of [Number.POSITIVE_INFINITY, 1000000000]) {
  test('IQVIA bounds native listing reads including closure for caller cap ' + maxPages, async () => {
    let reads = 0
    const jobs = await createIqviaScraper().run({ maxPages, fetchText: async url => {
      if (++reads > 20) throw new Error('unbounded native listing reads escaped the hard page cap')
      const page = Number(new URL(url).searchParams.get('page') || 1)
      return listing(page, page, 'R' + (8000 + page), 'London, United Kingdom').replace('of 3 jobs', 'of 1000000 jobs')
    } })
    assert.equal(reads, 20)
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  })
}

test('IQVIA source deadline reaches the active public transport', async () => {
  await assert.rejects(createIqviaScraper().run({ sourceDeadlineMs: 5, fetchText: async (_url, { signal } = {}) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('public read did not receive source deadline')), 200)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  }) }), error => error.name === 'TimeoutError')
})

test('IQVIA bounds all native public reads when one response contains an unexpectedly large set of valid roles', async () => {
  let reads = 0
  await assert.rejects(createIqviaScraper().run({ maxPages: 1, fetchText: async url => {
    if (++reads > 256) throw new Error('unbounded public reads escaped the request budget')
    if (url === buildListingUrl(1)) return '<p class="results-count">Showing 1-300 of 300 jobs</p>' + Array.from({ length: 300 }, (_, index) => listing(1, 1, 'R' + (8000 + index), 'Pune, Maharashtra, India').replace(/<p class="results-count">.*?<\/p>/, '')).join('')
    return detail(url.split('/').pop())
  } }), /public-read-budget/i)
  assert.equal(reads, 256)
})

test('IQVIA honors a zero caller page cap without observing an empty inventory', async () => {
  const jobs = await createIqviaScraper().run({ maxPages: 0, fetchText: async () => assert.fail('zero cap must not read') })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('IQVIA cannot inherit native country from an India listing when its own location field is unavailable', async () => {
  const jobs = await createIqviaScraper().run({ fetchText: async url => url === buildListingUrl(1)
    ? listing(1, 1, 'R8000', 'Pune, Maharashtra, India').replace('of 3 jobs', 'of 1 jobs')
    : detail('R8000').replace('<dt>Location</dt><dd>Pune, Maharashtra, India</dd>', '') })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('IQVIA requires the own detail requisition instead of substituting the listing identifier', async () => {
  await assert.rejects(createIqviaScraper().run({ fetchText: async url => url === buildListingUrl(1)
    ? listing(1, 1, 'R8000', 'Pune, Maharashtra, India').replace('of 3 jobs', 'of 1 jobs')
    : detail('R8000').replace('<dt>Job ID</dt><dd>R8000</dd>', '') }), /native.*requisition|identity/i)
})

test('IQVIA rejects a change to full own criteria during closing reconciliation', async () => {
  let detailReads = 0
  await assert.rejects(createIqviaScraper().run({ fetchText: async url => url === buildListingUrl(1)
    ? listing(1, 1, 'R8000', 'Pune, Maharashtra, India').replace('of 3 jobs', 'of 1 jobs')
    : detail('R8000').replace('SQL', ++detailReads === 1 ? 'SQL' : 'Rust') }), /closing|changed/i)
})

test('IQVIA rejects a native requisition change during its closing detail read', async () => {
  let detailReads = 0
  await assert.rejects(createIqviaScraper().run({ fetchText: async url => url === buildListingUrl(1)
    ? listing(1, 1, 'R8000', 'Pune, Maharashtra, India').replace('of 3 jobs', 'of 1 jobs')
    : detail(++detailReads === 1 ? 'R8000' : 'R9000') }), /closing|identity|requisition/i)
})

test('IQVIA rejects a native listing identity change during closure', async () => {
  let listingReads = 0
  await assert.rejects(createIqviaScraper().run({ fetchText: async url => url === buildListingUrl(1)
    ? listing(1, 1, ++listingReads === 1 ? 'R8000' : 'R9000', 'Pune, Maharashtra, India').replace('of 3 jobs', 'of 1 jobs')
    : detail('R8000') }), /closing|changed/i)
})

test('IQVIA marks an HTTP denial as a nonretryable public access stop', async () => {
  const previous = globalThis.fetch; let reads = 0
  globalThis.fetch = async () => { reads++; return new Response('Forbidden', { status: 403 }) }
  try { await assert.rejects(createIqviaScraper().run(), error => error.status === 403 && error.abortRetries === true) }
  finally { globalThis.fetch = previous }
  assert.equal(reads, 1)
})

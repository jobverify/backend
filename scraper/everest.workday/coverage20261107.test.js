import assert from 'node:assert/strict'
import test from 'node:test'
import { createEverestScraper, HOMEPAGE_URL, CAREERS_PAGE_URL, CAREERS_OVERVIEW_URL, WORKDAY_BOARD_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const homepage = { status: 200, url: 'https://www.everestglobal.com/us-en', html: '<title>Welcome to Everest | Everest</title><link rel="canonical" href="https://www.everestglobal.com/us-en"><p>We underwrite opportunity.</p><a href="/us-en/career-opportunities">Careers</a><a href="/us-en/about-us">About us</a>' }
const careers = { status: 200, url: CAREERS_OVERVIEW_URL, html: `<title>Careers | Everest</title><link rel="canonical" href="${CAREERS_OVERVIEW_URL}"><h1>Careers</h1><p>Ready to take your next step?</p><a href="${WORKDAY_BOARD_URL}">Search Jobs</a>` }
const board = { status: 200, url: WORKDAY_BOARD_URL, html: `<meta property="og:title" content="Careers"><meta property="og:url" content="${WORKDAY_BOARD_URL}"><script>window.workday = { tenant: "everestre", siteId: "careers" };</script><p>Beware of recruitment fraud. EVEREST is a leading international reinsurance and insurance group</p>` }
const row = (id, location = 'London, United Kingdom') => ({ title: 'Risk Analyst ' + id, externalPath: `/job/London/Risk-Analyst_R${id}`, locationsText: location, bulletFields: ['R' + id], postedOn: 'Posted Today' })
const pages = async url => {
  if (url === HOMEPAGE_URL) return homepage
  if (url === CAREERS_PAGE_URL) return careers
  if (url === WORKDAY_BOARD_URL) return board
  throw new Error('Unexpected page ' + url)
}

test('Everest visits remaining offsets after a short page using the first native total', async () => {
  const offsets = []
  const jobs = await createEverestScraper().run({ fetchPage: pages, fetchJson: async (_url, body) => {
    const { offset } = JSON.parse(body); offsets.push(offset)
    return { total: offset === 0 ? 3 : 0, jobPostings: [row(8000 + offset)] }
  } })
  assert.deepEqual(offsets, [0, 1, 2, 0, 1, 2])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Everest rejects a native listing that runs out before its advertised total', async () => {
  await assert.rejects(createEverestScraper().run({ fetchPage: pages, fetchJson: async (_url, body) => {
    const { offset } = JSON.parse(body)
    return offset === 0 ? { total: 2, jobPostings: [row(8000)] } : { total: 0, jobPostings: [] }
  } }), /incomplete|exhausted/i)
})

test('Everest rejects a repeated native posting before the total is reached', async () => {
  await assert.rejects(createEverestScraper().run({ fetchPage: pages, fetchJson: async () => ({ total: 2, jobPostings: [row(8000)] }) }), /duplicat|repeat/i)
})

test('Everest does not emit a direct India summary when its native detail fails', async () => {
  await assert.rejects(createEverestScraper().run({ fetchPage: async url => {
    if (url.includes('/job/')) throw new Error('native detail unavailable')
    return pages(url)
  }, fetchJson: async () => ({ total: 1, jobPostings: [row(8000, 'Mumbai, India')] }) }), /native detail unavailable/)
})

test('Everest checks caller cancellation before the next public read', async () => {
  const controller = new AbortController(); let reads = 0
  await assert.rejects(createEverestScraper().run({ signal: controller.signal, fetchPage: async url => {
    reads++; controller.abort(new Error('caller cancelled'))
    return pages(url)
  }, fetchJson: async () => ({ total: 0, jobPostings: [] }) }), /caller cancelled/)
  assert.equal(reads, 1)
})

test('Everest rejects a changed closing inventory instead of declaring an empty India inventory', async () => {
  let reads = 0
  await assert.rejects(createEverestScraper().run({ fetchPage: pages, fetchJson: async () => ({ total: 1, jobPostings: [row(++reads === 1 ? 8000 : 8001)] }) }), /closing|changed/i)
})

test('Everest rejects a closing careers handoff that no longer binds its Workday board', async () => {
  let careerReads = 0
  await assert.rejects(createEverestScraper().run({ fetchPage: async url => {
    if (url === CAREERS_PAGE_URL && ++careerReads > 1) return { ...careers, html: careers.html.replace(WORKDAY_BOARD_URL, 'https://example.org/jobs') }
    return pages(url)
  }, fetchJson: async () => ({ total: 0, jobPostings: [] }) }), /closing|handoff/i)
})

const fullNativeCriteria = 'Job Description: Maintain public risk platforms. Basic Qualifications: Three years of Python experience. Required Skills: SQL and Linux. Preferred Qualifications: Experience with actuarial data.'
const ownDetail = ({ requisition = 'R8000', description = fullNativeCriteria, validThrough } = {}) => '<html><h1>Risk Analyst 8000</h1><script type="application/ld+json">' + JSON.stringify({
  '@type': 'JobPosting', title: 'Risk Analyst 8000', identifier: requisition == null ? undefined : { value: requisition },
  description, datePosted: '2026-10-05', validThrough, jobLocation: { address: { addressCountry: 'India', addressLocality: 'Mumbai' } },
}) + '</script><dl><dt>Locations</dt><dd>Mumbai, India</dd></dl></html>'
const runOwnRole = (getDetail, options = {}) => createEverestScraper().run({
  fetchPage: async url => url.includes('/job/') ? { status: 200, url, html: await getDetail() } : pages(url),
  fetchJson: async () => ({ total: 1, jobPostings: [row(8000, 'Mumbai, India')] }), ...options,
})

test('Everest rejects an India detail that lacks native criteria', async () => {
  await assert.rejects(runOwnRole(() => ownDetail({ description: undefined }).replace(/,"description":"[^"]*"/, '')), /criteria|description/i)
})

test('Everest rejects a native title-only value as unavailable role criteria', async () => {
  await assert.rejects(runOwnRole(() => ownDetail({ description: 'Title: Risk Analyst 8000' })), /criteria|description/i)
})

test('Everest rejects a native requisition that differs from its listing', async () => {
  await assert.rejects(runOwnRole(() => ownDetail({ requisition: 'R9000' })), /native.*requisition|identity/i)
})

test('Everest requires an own native requisition instead of inheriting the listing identifier', async () => {
  await assert.rejects(runOwnRole(() => ownDetail({ requisition: null })), /native.*requisition|identity/i)
})

test('Everest retains the entire own native description including its qualification sections', async () => {
  const jobs = await runOwnRole(() => ownDetail())
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, fullNativeCriteria)
  assert.equal(jobs[0].sourceDescription, fullNativeCriteria)
  assert.equal(jobs[0].nativeSourceRecord.identifier.value, 'R8000')
})

test('Everest retains native publication precision instead of deriving a fresh date from a relative listing label', async () => {
  const jobs = await runOwnRole(() => ownDetail())
  assert.equal(jobs[0].postedAt, '2026-10-05')
  assert.equal(jobs[0].postingDatePrecision, 'calendar-date')
  assert.equal(jobs[0].firstEverPostedAt, null)
})

test('Everest rejects changed own criteria during its closing detail read', async () => {
  let detailReads = 0
  await assert.rejects(runOwnRole(() => ownDetail({ description: ++detailReads === 1 ? fullNativeCriteria : fullNativeCriteria.replace('SQL', 'Rust') })), /closing.*(?:criteria|detail|changed)/i)
})

test('Everest rejects a changed native requisition during its closing detail read', async () => {
  let detailReads = 0
  await assert.rejects(runOwnRole(() => ownDetail({ requisition: ++detailReads === 1 ? 'R8000' : 'R9000' })), /closing|native.*requisition|identity/i)
})

for (const maxPages of [Number.POSITIVE_INFINITY, 1000000000]) {
  test('Everest bounds native pagination even when a caller supplies ' + maxPages, async () => {
    let reads = 0
    await assert.rejects(createEverestScraper({ maxPages }).run({ fetchPage: pages, fetchJson: async () => {
      if (++reads > 10) throw new Error('unbounded native reads escaped the hard page cap')
      return { total: 1000000, jobPostings: [row(8000 + reads)] }
    } }), /page cap.*incomplete/i)
    assert.equal(reads, 10)
  })
}

test('Everest source deadline reaches the active public transport', async () => {
  await assert.rejects(createEverestScraper().run({ sourceDeadlineMs: 5, fetchPage: async (_url, { signal } = {}) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('public read did not receive source deadline')), 200)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  }) }), error => error.name === 'TimeoutError')
})

test('Everest honors a zero caller page cap without any public observation or empty-inventory claim', async () => {
  const jobs = await createEverestScraper().run({ maxPages: 0, fetchPage: async () => assert.fail('zero cap must not read'), fetchJson: async () => assert.fail('zero cap must not read') })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const validThrough of ['2026-11-06', '2026-11-07T13:00:00Z']) {
  test('Everest holds a role with explicit expired native validThrough ' + validThrough, async () => {
    const jobs = await runOwnRole(() => ownDetail({ validThrough }), { now: () => '2026-11-07T14:00:00Z' })
    assert.equal(jobs.length, 0)
    const audit = jobs[Symbol.for('jobverify.everest.native-inventory-observations')]
    assert.equal(audit.heldNativeRoles.length, 1)
    assert.equal(audit.heldNativeRoles[0].nativeSourceRecord.validThrough, validThrough)
    assert.equal(audit.heldNativeRoles[0].reason, 'native-role-known-closed')
  })
}

test('Everest preserves an own native closing calendar date and keeps it current throughout that day', async () => {
  const jobs = await runOwnRole(() => ownDetail({ validThrough: '2026-11-07' }), { now: () => '2026-11-07T23:00:00Z' })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].closingDate, '2026-11-07')
  assert.equal(jobs[0].sourceClosingDateIsExact, false)
})

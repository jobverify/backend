import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch = async () => { throw new Error('OFFLINE NETWORK TRIPWIRE') }
const excelacom = await import('../../scraper/excelacom/script.js')
const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
const { analyzePublishableJobs } = await import('../utils/publishableJobMetrics.js')
const { readHtml } = await import('../../scraper/excelacom/nativeHtml.js')

const CAREERS = 'https://www.excelacom.com/careers.html'
const SEARCH = 'https://phg.tbe.taleo.net/phg02/ats/careers/v2/jobSearch?act=redirectCwsV2&cws=38&org=EXCELACOM'
const BOARD = 'https://phg.tbe.taleo.net/phg02/ats/careers/v2/searchResults?org=EXCELACOM&cws=38'
const NEXT = `${BOARD}&act=page&page=2`
const roleUrl = id => `https://phg.tbe.taleo.net/phg02/ats/careers/v2/viewRequisition?org=EXCELACOM&cws=38&rid=${id}`
const applyUrl = id => `https://phg.tbe.taleo.net/phg02/ats/careers/v2/applyRequisition?org=EXCELACOM&cws=38&rid=${id}`
const NOW = new Date('2026-10-27T07:00:00Z')
const careers = extra => `<a href="careers.html">Careers</a><a href="${SEARCH}">BROWSE NEW OPENINGS</a>${extra || ''}`
const search = `<form id="TBE_theForm" action="${BOARD}" method="post"><input type="hidden" name="act" value="search"><input name="org" value="EXCELACOM"><input name="cws" value="38"></form>`
const listing = (ids, { total = ids.length, next = null } = {}) => `<div id="oracletaleocwsv2-wrapper"><span class="oracletaleocwsv2-panel-number">${total}</span>${ids.map(id => `<h4><a class="viewJobLink" href="${roleUrl(id)}">Engineer ${id}</a></h4>`).join('')}${next ? `<a rel="next" href="${next}">Next</a>` : ''}</div>`
const JD = `<p>Role and Responsibilities:</p><ul><li>Build reliable telecom services and maintain production systems.</li></ul><p>Required Qualifications:</p><ul><li>Bachelor&#8217;s degree in Computer Science.</li><li>3+ years of Java experience and SQL expertise.</li></ul><p>Preferred Qualifications:</p><p>Camunda and distributed workflow experience.</p><p>Compensation and Benefits:</p><p>Salary INR 20-30 lakh. Health insurance.</p><p>EEO Statement:</p><p>Excelacom is an equal opportunity employer.</p>`
const detail = (id, { country = 'IN', state = 'Karnataka', region = 'IN-KA', city = 'Bengaluru', code = `JOB-${id}`, req = null, jd = JD, employer = 'Excelacom', type = 'Full time', posted = '2026-10-19 15:08:55.0', validThrough, title = `Engineer ${id}`, jsonUrl = roleUrl(id), application = applyUrl(id), extra = '', noCountry = false } = {}) => {
  const metadata = { '@type': 'JobPosting', title, url: jsonUrl, identifier: { '@type': 'PropertyValue', name: 'Excelacom', value: code }, datePosted: posted, employmentType: type, hiringOrganization: { '@type': 'Organization', name: employer }, jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: state, ...(region ? { addressRegion: region } : {}), ...(!noCountry && country ? { addressCountry: { '@type': 'Country', name: country } } : {}) } }, description: jd, ...(validThrough ? { validThrough } : {}) }
  const field = (label, value) => `<div><span class="small">${label}</span><strong>${value}</strong></div>`
  return `<div id="oracletaleocwsv2-wrapper"><script type="application/ld+json">${JSON.stringify(metadata).replace(/</g, '\\u003c')}</script><div class="well oracletaleocwsv2-job-description"><strong>${title}</strong><div class="row">${field('Location City', city)}${field('Location', state)}${field('Job Code', code)}${req ? field('Requisition ID', req) : ''}</div></div><div name="cwsJobDescription">${jd}</div><a href="${application}">Apply Now</a>${extra}</div>`
}
const transport = ({ pages = new Map([[BOARD, listing(['1'])]]), details = new Map([['1', detail('1')]]), corporate = careers(), mutateClose = null, fail = null } = {}) => {
  const calls = [], counts = new Map()
  return { calls, fetchText: async url => {
    calls.push(url)
    counts.set(url, (counts.get(url) || 0) + 1)
    if (fail?.url === url) return { status: fail.status, url, body: fail.body || '<h1>Access denied</h1>' }
    if (url === CAREERS) return corporate
    if (url === SEARCH) return search
    if (pages.has(url)) return mutateClose && counts.get(url) > 1 ? mutateClose(url) : pages.get(url)
    const id = new URL(url).searchParams.get('rid')
    if (url === roleUrl(id) && details.has(id)) return details.get(id)
    throw new Error(`Unexpected offline request: ${url}`)
  } }
}
const run = t => excelacom.createExcelacomScraper().run({ fetchText: t.fetchText, now: () => NOW })

test('native run enumerates pages and full details and closes the same scope before applying maxJobs', async () => {
  const t = transport({ pages: new Map([[BOARD, listing(['1'], { total: 3, next: NEXT })], [NEXT, listing(['2', '3'], { total: 3 })]]), details: new Map([['1', detail('1')], ['2', detail('2')], ['3', detail('3', { country: 'US', state: 'Colorado', region: 'US-CO', city: 'Denver' })]]) })
  const jobs = await excelacom.createExcelacomScraper().run({ fetchText: t.fetchText, now: () => NOW, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '1')
  assert.equal(jobs[0].postingId, '1')
  assert.equal(jobs[0].requisitionId, null)
  assert.equal(jobs[0].nativeJobCode, 'JOB-1')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceGlobalJobCount, 3)
  assert.equal(jobs[0].sourceObservedIndiaJobCount, 2)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /output-limit/)
  assert.deepEqual(t.calls, [CAREERS, SEARCH, BOARD, NEXT, roleUrl('1'), roleUrl('2'), roleUrl('3'), BOARD, NEXT])
})

test('India roles retain all criteria, genuine source dates and actual application links without invented work type', async () => {
  const jobs = await run(transport({ details: new Map([['1', detail('1', { req: 'REQ-2026-19', type: 'Any Status' })]]) }))
  const [job] = jobs
  assert.equal(job.requisitionId, 'REQ-2026-19')
  assert.equal(job.postingDate, '2026-10-19')
  assert.equal(job.sourcePostingDateRaw, '2026-10-19 15:08:55.0')
  assert.equal(job.closingDate, null)
  assert.equal(job.employmentType, null)
  assert.equal(job.nativeEmploymentType, 'Any Status')
  assert.equal(job.workType, null)
  assert.equal(job.nativeEmployer, 'Excelacom')
  assert.equal(job.applyUrl, applyUrl('1'))
  assert.equal(job.sourceUrl, roleUrl('1'))
  assert.match(job.jobDescription, /Bachelor’s degree/)
  assert.match(job.minimumQualification, /3\+ years of Java experience and SQL/)
  assert.match(job.preferredQualification, /Camunda/)
  assert.match(job.jobDescription, /Salary INR 20-30 lakh/)
  assert.match(job.jobDescription, /Health insurance/)
  assert.equal(job.sourceScopeComplete, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(analyzePublishableJobs(jobs, { now: NOW }).eligibleJobs.length, 1)
})

test('unknown country cannot be inferred from corporate HQ, work authorization or a familiar city', async () => {
  const t = transport({ pages: new Map([[BOARD, listing(['1', '2'])]]), details: new Map([['1', detail('1')], ['2', detail('2', { noCountry: true, state: 'Global', region: null, city: 'Bengaluru', jd: JD + '<p>Headquarters India. Must be authorized to work in the United States.</p>' })]]) })
  const jobs = await run(t)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs).reason, /country-unresolved:2/)
})

test('native Missouri worksite and US-TX region qualify with retained official US state evidence', () => {
  const row = { jobId: '1', title: 'Engineer 1', sourceUrl: roleUrl('1') }
  const missouri = excelacom.parseNativeDetail(detail('1', { noCountry: true, state: 'Missouri', city: 'St Louis', region: null }), row)
  assert.equal(missouri.country, 'United States')
  assert.equal(missouri.sourceCountryEvidence.nativeCountryMissing, true)
  assert.equal(missouri.sourceCountryEvidence.nativeValue, 'Missouri')
  assert.match(missouri.sourceCountryEvidence.referenceUrl, /^https:\/\/www\.census\.gov\//)
  const texas = excelacom.parseNativeDetail(detail('1', { noCountry: true, state: 'Texas', city: '', region: 'US-TX' }), row)
  assert.equal(texas.country, 'United States')
  assert.equal(texas.sourceCountryEvidence.nativeValue, 'US-TX')
})

test('contradictory explicit country and officially qualified native worksite cannot publish', async () => {
  await assert.rejects(run(transport({ details: new Map([['1', detail('1', { country: 'IN', state: 'Missouri', city: 'St Louis', region: 'US-MO' })]]) })), /country|worksite|conflict/i)
  await assert.rejects(run(transport({ details: new Map([['1', detail('1', { noCountry: true, state: 'Missouri', region: 'US-TX' })]]) })), /country|worksite|conflict/i)
})

test('hidden and inert markup cannot supply criteria and text entities decode once', () => {
  const hidden = '<template><p>Fake required skill</p></template><object><p>Object fallback</p></object><p hidden>Hidden requirement</p><p style="display:none">Invisible condition</p><p class="ghost">Stylesheet hidden condition</p><script>visibleFake()</script><textarea><p>Raw fallback</p></textarea>'
  const html = detail('1', { jd: JD + hidden + '<p>Literal &amp;lt;b&amp;gt; &lt;script&gt;literal&lt;/script&gt;.</p>', extra: '<style>.ghost {display: none}</style>' })
  const job = excelacom.parseNativeDetail(html, { jobId: '1', title: 'Engineer 1', sourceUrl: roleUrl('1') })
  assert.doesNotMatch(job.jobDescription, /Fake required|Object fallback|Hidden requirement|Invisible condition|Stylesheet hidden|visibleFake|Raw fallback/)
  assert.match(job.jobDescription, /Literal &lt;b&gt; <script>literal<\/script>/)
})

for (const [label, options] of [
  ['employer', { employer: 'Another Employer' }], ['title', { title: 'Different role' }],
  ['structured URL', { jsonUrl: roleUrl('9') }], ['application rid', { application: applyUrl('9') }],
  ['inert-only description', { jd: '<template>' + JD + '</template>' }],
]) test(`native detail rejects mismatched ${label}`, async () => {
  await assert.rejects(run(transport({ details: new Map([['1', detail('1', options)]]) })), /Excelacom|native|identity|description/i)
})

test('anonymous denials stop immediately without another request', async () => {
  for (const status of [401, 403, 429]) {
    const t = transport({ fail: { url: BOARD, status } })
    await assert.rejects(run(t), new RegExp(String(status)))
    assert.deepEqual(t.calls, [CAREERS, SEARCH, BOARD])
  }
  const t = transport({ fail: { url: BOARD, status: 200, body: '<title>Verify you are human</title><h1>Complete the CAPTCHA to continue</h1>' } })
  await assert.rejects(run(t), /gate|denied|captcha/i)
  assert.deepEqual(t.calls, [CAREERS, SEARCH, BOARD])
})

test('closing identity changes, pagination truncation and repeated pages cannot claim complete inventory', async () => {
  await assert.rejects(run(transport({ mutateClose: () => listing(['2']) })), /changed|closing|inventory/i)
  await assert.rejects(run(transport({ pages: new Map([[BOARD, listing(['1'], { total: 2 })]]) })), /count|terminal|inventory/i)
  await assert.rejects(run(transport({ pages: new Map([[BOARD, listing(['1'], { total: 2, next: BOARD })]]) })), /cycle|repeat|pagination/i)
})

test('additional advertised hiring channels keep healthy India details but mark company scope incomplete', async () => {
  const jobs = await run(transport({ corporate: careers('<a href="https://another.example/jobs">Other job openings</a>') }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /additional-hiring-channel/)
})

test('an advertised regional careers URL labelled India prevents unreviewed whole-employer absence', async () => {
  const jobs = await run(transport({ corporate: careers('<section><h2>Regional Careers</h2><a href="https://another.example/careers/india">India</a></section>') }))
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].sourceOfficialBinding.extraChannels.length, 1)
})

test('opaque regional hiring links inherit their own careers heading without treating office footer links as hiring', async () => {
  const t = transport({ corporate: careers('<section><h2>Regional Careers</h2><a href="https://another.example/in/">India</a></section><footer><h2>Global offices</h2><a href="https://locations.example/in/">India</a></footer>') })
  const jobs = await run(t)
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.deepEqual(jobs[0].sourceOfficialBinding.extraChannels, ['https://another.example/in/'])
  const footerOnly = await run(transport({ corporate: careers('<footer><h2>Global offices</h2><a href="https://locations.example/in/">India</a></footer>') }))
  assert.equal(readInventoryEvidence(footerOnly).listingComplete, true)
  assert.deepEqual(footerOnly[0].sourceOfficialBinding.extraChannels, [])
})

test('CSS ancestor and child selectors preserve visible native criteria and hide only their actual matches', () => {
  const jd = JD + '<style>.not-present .review-required {display:none}.actual > .child-only {display:none}</style><p class="review-required">Must have current security clearance.</p><div class="actual"><p class="child-only">Hidden direct-child criterion.</p><div><p class="child-only">Visible nested qualification.</p></div></div>'
  const job = excelacom.parseNativeDetail(detail('1', { jd }), { jobId: '1', title: 'Engineer 1', sourceUrl: roleUrl('1') })
  assert.match(job.jobDescription, /Must have current security clearance/)
  assert.match(job.jobDescription, /Visible nested qualification/)
  assert.doesNotMatch(job.jobDescription, /Hidden direct-child criterion/)
  assert.equal(job.sourceDetailComplete, true)
  const d = readHtml('<style>.not-present p {display:none}</style><div><p>Required qualification visible in browser.</p><div>Other prose.</div></div>')
  assert.match(d.text(d.root), /Required qualification visible in browser/)
})

test('unsupported CSS visibility selectors reject incomplete detail claims instead of guessing what is hidden', () => {
  const jd = JD + '<style>p:has(.child) {display:none}</style><p>Visible requirement without a matching child.</p>'
  assert.throws(() => excelacom.parseNativeDetail(detail('1', { jd }), { jobId: '1', title: 'Engineer 1', sourceUrl: roleUrl('1') }), /visibility selector|unsupported CSS/i)
})

test('conditional hiding that could affect native criteria rejects a complete static detail claim', () => {
  for (const condition of ['@media (min-width:99999px)', '@media (min-width:0px)', '@supports (display:grid)', '@container (min-width:1px)']) {
    const jd = JD + `<style>${condition} {.review-required {display:none}}</style><p class="review-required">Must have current security clearance.</p>`
    assert.throws(() => excelacom.parseNativeDetail(detail('1', { jd }), { jobId: '1', title: 'Engineer 1', sourceUrl: roleUrl('1') }), /conditional visibility/i)
  }
  const jd = JD + '<style media="(min-width:99999px)">.review-required {display:none}</style><p class="review-required">Must have current security clearance.</p>'
  assert.throws(() => excelacom.parseNativeDetail(detail('1', { jd }), { jobId: '1', title: 'Engineer 1', sourceUrl: roleUrl('1') }), /conditional visibility/i)
})

test('unmatched conditional selectors preserve visible criteria and unconditional hiding still hides its real match', () => {
  const jd = JD + '<style>@media (min-width:99999px) {.not-present .review-required {display:none}}.always-hidden {display:none}</style><p class="review-required">Must have current security clearance.</p><p class="always-hidden">Unconditionally hidden criterion.</p>'
  const job = excelacom.parseNativeDetail(detail('1', { jd }), { jobId: '1', title: 'Engineer 1', sourceUrl: roleUrl('1') })
  assert.match(job.jobDescription, /Must have current security clearance/)
  assert.doesNotMatch(job.jobDescription, /Unconditionally hidden criterion/)
  assert.equal(job.sourceDetailComplete, true)
})

test('country contradiction validation covers US-CO and typed Colorado beyond the narrow missing-country inference map', async () => {
  for (const options of [
    { country: 'IN', state: 'Colorado', city: 'Greenwood Village', region: 'US-CO' },
    { country: 'IN', state: 'Colorado', city: 'Greenwood Village', region: null },
    { country: 'IN', state: 'London', city: 'London', region: 'GB-LND' },
  ]) await assert.rejects(run(transport({ details: new Map([['1', detail('1', options)]]) })), /conflict|country|worksite/i)
})

test('missing official binding never falls back to the historical RSS endpoint', async () => {
  const t = transport({ corporate: '<h1>Excelacom careers</h1>' })
  await assert.rejects(run(t), /binding|official|careers/i)
  assert.deepEqual(t.calls, [CAREERS])
})

test('a truly empty future board uses the native binding and closing contract', async () => {
  const t = transport({ pages: new Map([[BOARD, listing([])]]) })
  const jobs = await run(t)
  assert.deepEqual([...jobs], [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.deepEqual(t.calls, [CAREERS, SEARCH, BOARD, BOARD])
})

test('unknown countries on a non-India board never produce verified India absence', async () => {
  const jobs = await run(transport({ details: new Map([['1', detail('1', { noCountry: true, state: 'Global', city: 'Delhi', region: null })]]) }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('placeholder native country codes remain unresolved while recognized foreign countries stay foreign', async () => {
  const unknown = await run(transport({ details: new Map([['1', detail('1', { country: 'ZZ', state: 'Global', city: 'Delhi', region: null })]]) }))
  assert.equal(unknown.length, 0)
  assert.equal(readInventoryEvidence(unknown).listingComplete, false)
  assert.match(readInventoryEvidence(unknown).reason, /country-unresolved/)
  const row = { jobId: '1', title: 'Engineer 1', sourceUrl: roleUrl('1') }
  const france = excelacom.parseNativeDetail(detail('1', { country: 'FR', state: 'Île-de-France', city: 'Paris', region: 'FR-IDF' }), row)
  assert.equal(france.country, 'France')
})

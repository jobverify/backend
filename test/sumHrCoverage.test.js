import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run, FIRST_PARTY_ROOT_URL, ABOUT_URL, ATS_URL } from '../scraper/sumhr/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

test('SumHR resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nSumHR\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SumHR', 'sumhr', 'SumHR']],
  )
})

const homepage = '<title>SumHR - Free HR Software In India</title><a href="/about-us/">About us</a><footer>sumHR</footer>'
const about = '<title>About SumHR</title><h2>See you soon!</h2><p>Want to join our fun bunch?</p><p>Simply send in a nice cover note about yourself with a CV, to: <a href="mailto:humans@sumhr.com">humans@sumhr.com</a></p>'
const fixture = name => gunzipSync(readFileSync(new URL('../scraper/sumhr/fixtures/' + name, import.meta.url))).toString()
const nativeFetch = (transform = (body) => body) => async url => new Response(transform(url === FIRST_PARTY_ROOT_URL ? homepage : url === ABOUT_URL ? about : fixture(url === ATS_URL ? 'candidate-ats-1.html.gz' : 'candidate-ats-2.html.gz'), url))

test('SumHR inspects the official join-by-email surface without certifying an empty inventory', async () => {
  const calls = []
  const jobs = await run({ fetchImpl: async (url) => { calls.push(url); return nativeFetch()(url) } })
  assert.equal(jobs.length, 1)
  assert.deepEqual(calls.slice(0, 3), [FIRST_PARTY_ROOT_URL, ABOUT_URL, ATS_URL])
  assert.equal(jobs[0].title, 'Sr. Software Developer (LAMP)')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.match(jobs[0].jobDescription, /PHP/)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.firstParty, false)
  assert.equal(evidence.pagesFetched, 4)
})

test('SumHR rejects changed identity, failed requests, redirects and oversized source bodies', async () => {
  for (const response of [new Response('access denied', { status: 403 }), new Response('Other employer'), new Response(homepage, { status: 302 }), new Response('x'.repeat(2 * 1024 * 1024 + 1))]) {
    await assert.rejects(run({ fetchImpl: async () => response }))
  }
})

test('SumHR rejects heading-only and changed join contracts', async () => {
  await assert.rejects(run({ fetchImpl: async url => new Response(url === FIRST_PARTY_ROOT_URL ? homepage : '<title>About SumHR</title><h2>See you soon!</h2>') }))
  await assert.rejects(run({ fetchImpl: nativeFetch((body, url) => url === ABOUT_URL ? '<template>' + body + '</template>' : body) }))
})

test('SumHR propagates exact preflight and in-flight caller abort reasons', async () => {
  for (const immediate of [true, false]) {
    const controller = new AbortController(), reason = { caller: 'cancelled' }
    if (immediate) controller.abort(reason)
    const promise = run({ signal: controller.signal, fetchImpl: () => new Promise(() => {}) })
    if (!immediate) controller.abort(reason)
    await assert.rejects(promise, error => error === reason)
  }
})

test('SumHR enforces a deadline through fetch and body consumption', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async () => new Response(new ReadableStream({ start() {} }))]) {
    await assert.rejects(run({ fetchImpl, timeoutMs: 10 }), /timed out/)
  }
})

test('SumHR actual official captures replay and every archived raw body matches its manifest', async () => {
  const base = new URL('../scraper/sumhr/fixtures/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', base)))
  const captures = new Map()
  for (const entry of manifest.captures) {
    const body = gunzipSync(readFileSync(new URL(entry.file, base)))
    assert.equal(createHash('sha256').update(body).digest('hex'), entry.sha256)
    assert.equal(body.length, entry.bytes)
    captures.set(entry.url, body)
  }
  const jobs = await run({ fetchImpl: async url => new Response(captures.get(url), { headers: { 'content-type': 'text/html' } }) })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('SumHR rejects native employer, client, form, country and title contradictions', async () => {
  for (const [pattern, replacement] of [
    [/u0mr5/g, 'other'], [/mailto:sid@sumhr.com/g, 'mailto:sid@example.com'],
    [/action="\/jobs\/fk03ii"/g, 'action="/jobs/other"'],
    [/meta-job-location-country">India/g, 'meta-job-location-country">Canada'],
    [/Sumhr/g, 'Another Employer'],
  ]) await assert.rejects(run({ fetchImpl: nativeFetch((body, url) => url.startsWith(ATS_URL) ? body.replace(pattern, replacement) : body) }))
  await assert.rejects(run({ fetchImpl: nativeFetch((body, url) => url.startsWith(ATS_URL) && url !== ATS_URL ? body.replace(/Sr\. Software Developer \(LAMP\)/g, 'Other Role') : body) }))
})

test('SumHR retains active India roles when descriptions are absent, hidden, heading-only or placeholders', async () => {
  for (const replacement of ['', '<div class="jobdesciption" hidden><p>Hidden responsibilities do not count as a description.</p></div>', '<div class="jobdesciption"><p hidden>Build and maintain our product platform, resolve software issues and work with engineers to deliver scalable applications. This content is hidden from the public.</p></div>', '<div class="jobdesciption"><h2>Responsibilities</h2></div>', '<div class="jobdesciption"><strong>Responsibilities and requirements '.repeat(5) + '</strong></div>', '<div class="jobdesciption"><p>The job description will be updated soon. Please return later for details about this opportunity.</p></div>']) {
    const jobs = await run({ fetchImpl: nativeFetch((body, url) => url === ATS_URL || !url.startsWith(ATS_URL) ? body : body.replace(/<div class="jobdesciption">[\s\S]*?<\/div>/, replacement)) })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobDescription, null)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})

test('SumHR validates public schema dates and all secondary country evidence', async () => {
  const schema = { '@type': 'JobPosting', title: 'Sr. Software Developer (LAMP)', hiringOrganization: { name: 'sumHR' }, jobLocation: { address: { addressCountry: 'India' } } }
  const inject = extra => nativeFetch((body, url) => url !== ATS_URL && url.startsWith(ATS_URL) ? body + '<script type="application/ld+json">' + JSON.stringify({ ...schema, ...extra }) + '</script>' : body)
  for (const extra of [ { datePosted: '2026-02-31' }, { datePosted: '2099-01-01' }, { validThrough: '2020-01-01' }, { applicantLocationRequirements: { '@type': 'Country', name: 'Canada' } }, { hiringOrganization: { name: 'Another' } }, { jobLocation: [schema.jobLocation, { address: { addressCountry: 'Canada' } }] } ]) await assert.rejects(run({ fetchImpl: inject(extra) }))
  const jobs = await run({ fetchImpl: inject({ datePosted: '2026-01-15' }) })
  assert.equal(jobs[0].postingDate, '2026-01-15')
})

test('SumHR rejects inherited inert native identity/cards/forms and prunes inactive descriptions', async () => {
  for (const wrapper of ['template', 'div hidden', 'div inert', 'div style="content-visibility:hidden"']) await assert.rejects(run({ fetchImpl: nativeFetch((body, url) => url.startsWith(ATS_URL) ? '<' + wrapper + '>' + body + '</' + wrapper.split(' ')[0] + '>' : body) }))
  await assert.rejects(run({ fetchImpl: nativeFetch((body, url) => url.startsWith(ATS_URL) && url !== ATS_URL ? body.replace('id="job_application_form"', 'id="job_application_form" hidden') : body) }))
  const jobs = await run({ fetchImpl: nativeFetch((body, url) => url.startsWith(ATS_URL) && url !== ATS_URL ? body.replace('class="jobdesciption"', 'class="jobdesciption" inert') : body) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  await assert.rejects(run({ fetchImpl: nativeFetch((body, url) => url.startsWith(ATS_URL) && url !== ATS_URL ? '<div id="application_form_holder" style="display:none">' + body + '</div>' : body) }))
  await assert.rejects(run({ fetchImpl: nativeFetch((body, url) => url.startsWith(ATS_URL) && url !== ATS_URL ? body.replace(/href="\?apply=true"/g, 'href="#inactive"') : body) }))
})

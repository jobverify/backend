import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { buildJobDerivedFields } from '../../src/utils/jobDerivedFields.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { CAREERS_URL, APPLY_URL, extractCurrentListings, extractCurrentFresherDetail, extractJobs, createWinmanSoftwareScraper } from './script.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(process.env.WINMAN_GEOGRAPHY_FIXTURE || new URL('./test-data/2026-11-01-native-geography.json.gz', import.meta.url))))
const [primary, redirect, canonical] = fixture.packets, sha = value => createHash('sha256').update(value).digest('hex'), listing = extractCurrentListings(primary.body).freshers[0]
const scraper = buildScrapers().find(item => item.name === 'winmansoftware'), clock = canonical.completedAt
// Explicitly controlled reduced cohort, NOT an exact full/default native run:
// retain one of the14 actual fresher links plus all8 actual experienced rows.
const reduced = primary.body.replace(/<table\b[^>]*id=["']freshers["'][\s\S]*?<\/table>/i, `<table id="freshers"><tr><td><a href="${listing.detailUrl}">${listing.title}</a></td></tr></table>`)
const replay = async ({ html = reduced, detail = canonical.body, maximum = null } = {}) => {
  const calls = [], run = maximum == null ? scraper : createWinmanSoftwareScraper({ maxJobs: maximum })
  const jobs = await run.run({ fetchText: async url => { calls.push(url); if (url === CAREERS_URL) return html; if (url === listing.detailUrl) return detail; throw Error('No retained body; this is a controlled test gap: ' + url) } })
  return { jobs, calls }
}
const publicUnknown = job => {
  for (const key of ['location', 'city', 'state', 'country']) assert.equal(job[key], null, key)
  assert.equal(job.nativeGeographyQualified, false)
}
const normalized = jobs => jobs.map(job => normalizeScrapedJob({ ...job, scrapedAt: clock }, scraper.provider))
const locationBlocks = [...canonical.body.matchAll(/<div class="job-info">(?:(?!<div\b)[\s\S])*?<\/div>/g)].map(match => match[0]).filter(block => block.includes('JobDescription-location.png'))
assert.equal(locationBlocks.length, 1)
const block = locationBlocks[0], changedBlock = value => canonical.body.replace(block, value)

test('Winman geography fixture preserves exact three receipts, bodies and actual clocks', () => {
  assert.deepEqual(fixture.packets.map(packet => packet.status), [200, 301, 200])
  assert.equal(sha(primary.body), 'abb9c9d183575b5180e8f55230d0d182159911abfddfa59a8cac66416bd2fffd')
  assert.equal(sha(canonical.body), '8a607ec037a52bbed0f5b27bb6678bfca145176bee3232311a8f930348eaa5a1')
  assert.equal(primary.requestedAt, '2026-11-01T02:36:50.506Z'); assert.equal(canonical.completedAt, '2026-11-01T02:50:28.749Z')
  assert.equal(redirect.body, null); assert.equal(redirect.completeBody, false); assert.equal(redirect.headers.location, canonical.url)
  assert.equal(fixture.unreadAdvertisedDetailCount, 13); assert.equal(fixture.companyScopeComplete, false)
})
test('Winman actual primary still yields exactly14 advertised fresher and8 experienced observations', () => {
  const rows = extractCurrentListings(primary.body)
  assert.equal(rows.freshers.length, 14); assert.equal(rows.experienced.length, 8)
  assert.deepEqual(rows.freshers[0], { title: 'Product Software Programmer', detailUrl: redirect.url })
})
test('Winman retains literal role-owned Mangalore only as explicitly unqualified native geography', () => {
  const detail = extractCurrentFresherDetail(canonical.body, listing), observation = detail.rawNativeWorkplaceEvidence
  assert.ok(observation)
  assert.equal(observation.locationLiteral, 'Mangalore'); assert.equal(observation.cityLiteral, 'Mangalore')
  assert.equal(observation.country, null); assert.equal(observation.state, null); assert.equal(observation.publicGeographyQualified, false)
  assert.equal(observation.roleTitle, listing.title); assert.equal(observation.sourceUrl, listing.detailUrl)
})
test('Winman controlled reduced real-registry replay withholds hardcoded public geography on all9 observations', async () => {
  const { jobs, calls } = await replay()
  assert.deepEqual(calls, [CAREERS_URL, listing.detailUrl]); assert.equal(jobs.length, 9)
  for (const job of jobs) publicUnknown(job)
  assert.equal(jobs[0].rawNativeWorkplaceEvidence.cityLiteral, 'Mangalore')
  assert.ok(jobs.slice(1).every(job => job.rawNativeWorkplaceEvidence === null))
  assert.equal(jobs[0].postingDate, null); assert.equal(jobs[0].closingDate, null)
  assert.equal(jobs[0].applyUrl, APPLY_URL); assert.equal(jobs[0].sourceUrl, listing.detailUrl)
})
test('Winman real registry plus normalizer cannot promote raw city or target-country metadata into public eligibility', async () => {
  const { jobs } = await replay(), rows = normalized(jobs), metrics = analyzePublishableJobs(rows, { now: new Date(clock) })
  assert.equal(scraper.provider.countryFilter, 'India')
  for (const job of rows) { publicUnknown(job); assert.equal(buildJobDerivedFields(job).isPublicIndia, false) }
  assert.equal(filterIndiaJobs(rows).length, 0); assert.equal(metrics.indiaJobs.length, 0); assert.equal(metrics.eligibleJobs.length, 0)
})
test('Winman city-only shared-policy control explains why native Mangalore stays out of public fields', () => {
  const row = { title: 'Controlled policy boundary', city: 'Mangalore', location: 'Mangalore', country: null, applyUrl: APPLY_URL, jobDescription: 'Controlled policy boundary only.' }
  assert.equal(filterIndiaJobs([row]).length, 1); assert.equal(buildJobDerivedFields(row).isPublicIndia, true)
})
test('Winman policy-only explicit India positive remains eligible after real normalizer', async () => {
  const { jobs } = await replay(), control = normalizeScrapedJob({ ...jobs[0], location: 'India', city: null, state: null, country: 'India', scrapedAt: clock }, scraper.provider)
  // This override is explicitly synthetic policy input, never source output.
  assert.equal(control.country, 'India'); assert.equal(buildJobDerivedFields(control).isPublicIndia, true)
  assert.equal(analyzePublishableJobs([control], { now: new Date(clock) }).eligibleJobs.length, 1)
})
test('Winman policy-only explicit foreign country defeats a conflicting Mangalore city after normalization', async () => {
  const { jobs } = await replay(), control = normalizeScrapedJob({ ...jobs[0], location: 'Mangalore', city: 'Mangalore', country: 'United States', scrapedAt: clock }, scraper.provider)
  assert.equal(control.country, 'United States'); assert.equal(filterIndiaJobs([control]).length, 0); assert.equal(buildJobDerivedFields(control).isPublicIndia, false)
})
test('Winman returned observations retain coverage-gap, null authority and lifecycle cleanup guards through registration', async () => {
  const { jobs } = await replay(), evidence = readInventoryEvidence(jobs), observation = readSourceObservationEvidence(jobs, 'winmansoftware')
  assert.equal(evidence?.status, 'coverage-gap'); assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null); assert.equal(evidence.indiaFacetCount, null); assert.equal(evidence.verifiedAt, null)
  assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: new Date(clock) }), false)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.equal(observation?.observedVacancyCount, 9); assert.equal(observation.sourceScopeComplete, false)
  assert.equal(observation.companyGlobalTotal, null); assert.equal(observation.companyIndiaTotal, null)
})
test('Winman maximum preserves native row order while observed count remains distinct from returned count', async () => {
  const { jobs, calls } = await replay({ maximum: 2 }), observation = readSourceObservationEvidence(jobs, 'winmansoftware')
  assert.deepEqual(calls, [CAREERS_URL, listing.detailUrl]); assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, listing.title); assert.equal(jobs[1].title, extractCurrentListings(primary.body).experienced[0].title)
  assert.equal(observation?.observedVacancyCount, 9); assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
const legacy = `<title>Careers for Experience Candidates - Winman Software</title><p>Winman company in Mangaluru. India marketing, INR salary, Winman Software India LLP.</p><table id="experienced_table"><tr><th>Designation and Job Profile</th><th>Experience</th></tr><tr><td><h5>Senior Accountant</h5>Overseeing the finalisation of accounts.</td><td>CA Articleship completed</td></tr><tr><td><h5>Electrical Maintenance Supervisor</h5>Supervising maintenance of electrical systems.</td><td>2 years</td></tr></table><a href="${APPLY_URL}">Apply now</a>`
test('Winman legacy corporate city, currency, marketing and legal-name text cannot qualify a role country', () => {
  const rows = extractJobs(legacy)
  assert.equal(rows.length, 2); for (const job of rows) { publicUnknown(job); assert.equal(job.rawNativeWorkplaceEvidence, null) }
})
for (const [label, transform] of [
  ['hidden', value => value.replace('<div ', '<div hidden ')],
  ['ARIA hidden', value => value.replace('<div ', '<div aria-hidden="true" ')],
  ['inline opacity', value => value.replace('<div ', '<div style="opacity:0" ')],
  ['template', value => '<template>' + value + '</template>'],
  ['comment', value => '<!--' + value + '-->'],
  ['author CSS hidden', value => '<style>.controlled-hidden{display:none}</style>' + value.replace('class="job-info"', 'class="job-info controlled-hidden"')],
]) test('Winman ' + label + ' workplace carrier supplies no active native location', () => {
  const detail = extractCurrentFresherDetail(changedBlock(transform(block)), listing)
  assert.equal(detail.rawNativeWorkplaceEvidence, null)
})
test('Winman another controlled role can retain the same native header shape without a role allowlist', () => {
  const title = 'Controlled Other Role', html = canonical.body.replaceAll(listing.title, title), row = { ...listing, title }
  const detail = extractCurrentFresherDetail(html, row)
  assert.equal(detail.title, title); assert.equal(detail.rawNativeWorkplaceEvidence?.cityLiteral, 'Mangalore'); assert.equal(detail.rawNativeWorkplaceEvidence.publicGeographyQualified, false)
})
test('Winman duplicate conflicting native location labels remain raw observations without choosing a city', () => {
  const detail = extractCurrentFresherDetail(changedBlock(block + block.replace('Mangalore', 'Controlled foreign workplace')), listing), raw = detail.rawNativeWorkplaceEvidence
  assert.deepEqual(raw?.observedLocationLiterals, ['Mangalore', 'Controlled foreign workplace']); assert.equal(raw.cityLiteral, null); assert.equal(raw.publicGeographyQualified, false)
})
test('Winman foreign country text in an unsupported native location schema does not qualify public geography', async () => {
  const html = changedBlock(block.replace('Mangalore', 'Mangalore, United States').replace('<div ', '<div data-country="US" ')), { jobs } = await replay({ detail: html })
  for (const job of jobs) publicUnknown(job)
  assert.equal(jobs[0].rawNativeWorkplaceEvidence.locationLiteral, 'Mangalore, United States')
  assert.equal(jobs[0].rawNativeWorkplaceEvidence.country, null)
})
test('Winman unretained detail bodies are not substituted or reported as a complete current native run', async () => {
  const reason = Object.freeze(new Error('Controlled missing retained body; no upstream availability claim')), calls = []
  await assert.rejects(scraper.run({ fetchText: async url => { calls.push(url); if (url === CAREERS_URL) return primary.body; if (url === listing.detailUrl) return canonical.body; throw reason } }), error => error === reason)
  // Existing bounded batch4 starts before an asynchronous sibling rejects.
  assert.deepEqual(calls, [CAREERS_URL, ...extractCurrentListings(primary.body).freshers.slice(0, 4).map(row => row.detailUrl)])
})
test('Winman an empty controlled observation array retains a coverage gap instead of company-zero authority', async () => {
  const html = legacy.replace(/<tr><td>[\s\S]*?<\/tr>/g, '') + '<p>Senior Accountant; Electrical Maintenance Supervisor</p>', jobs = await scraper.run({ fetchText: async () => html })
  assert.equal(jobs.length, 0); assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null); assert.equal(readInventoryEvidence(jobs).verifiedAt, null)
})
test('Winman missing original role signals still rejects the original weak empty-page control', async () => {
  const html = legacy.replace(/<tr><td>[\s\S]*?<\/tr>/g, '')
  await assert.rejects(scraper.run({ fetchText: async () => html }), /verified Winman Software careers surface/i)
})

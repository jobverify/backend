import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const source = { source: 'microdata-example', companyName: 'Example', companyDomain: 'example.test', companyCareerPage: 'https://example.test/careers' }
const url = 'https://example.test/job/Verna/1447116500/'
const description = 'Develop software services and maintain reliable systems. Work with engineering teams to review API designs, investigate production failures, and improve service performance and availability.'
const html = ({ employer = 'Example Inc.', country = 'In', title = 'Graduate Engineer Trainee', body = description, extra = '', before = '', after = '' } = {}) => `${before}
<div itemscope itemtype="http://schema.org/JobPosting">
 <span itemprop="jobLocation" itemscope itemtype="http://schema.org/Place"><span itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
 <meta itemprop="addressLocality" content="Verna"><meta itemprop="addressRegion" content="Goa"><meta itemprop="addressCountry" content="${country}"></span></span>
 <meta itemprop="datePosted" content="Tue Nov 03 00:00:00 UTC 2026"><meta itemprop="validThrough" content="Tue Nov 10 18:30:00 UTC 2026">
 <meta itemprop="hiringOrganization" content="${employer}">
 <h2><span itemprop="title">${title}</span></h2><div itemprop="description"><p>${body}</p></div>${extra}
</div>${after}`
const run = content => createVerifiedRecruitmentScraper(source).run({ now: () => '2026-11-03T14:00:00Z', fetchPage: async requested => ({ status: 200, url: requested,
  html: requested === url ? content : requested === source.companyCareerPage ? `<h1>Example Careers</h1><a href="${url}">Graduate Engineer Trainee</a>` : '<h1>Example</h1>' }) })

test('reads visible native HTML JobPosting microdata with explicit country and employer', async () => {
  const jobs = await run(html())
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, url)
  assert.equal(jobs[0].title, 'Graduate Engineer Trainee')
  assert.equal(jobs[0].sourceDescription, description)
  assert.equal(jobs[0].nativeHiringOrganization.name, 'Example Inc.')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, 'Tue Nov 03 00:00:00 UTC 2026')
  assert.equal(jobs[0].nativeSourceRecord.nativeRepresentation, 'html-microdata')
  assert.equal(jobs[0].applyUrl, url)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const [name, content] of [
  ['another employer', html({ employer: 'Other Company' })],
  ['a foreign country', html({ country: 'US' })],
  ['an unrecognized country', html({ country: 'Verna' })],
  ['a short teaser', html({ body: 'Apply now.' })],
  ['conflicting native countries', html({ extra: '<span itemprop="jobLocation" itemscope><span itemprop="address" itemscope><meta itemprop="addressCountry" content="US"><meta itemprop="addressCountry" content="IN"></span></span>' })],
  ['an expired vacancy', html().replace('Tue Nov 10 18:30:00 UTC 2026', 'Thu Oct 01 00:00:00 UTC 2026')],
]) test('microdata rejects ' + name + ' without certifying an empty company inventory', async () => {
  const jobs = await run(content)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('inert microdata and metadata-only descriptions cannot supply a visible job', async () => {
  for (const content of ['<template>' + html() + '</template>', '<div hidden>' + html() + '</div>',
    html().replace(`<div itemprop="description"><p>${description}</p></div>`, `<meta itemprop="description" content="${description}">`)]) {
    try { assert.equal((await run(content)).length, 0) } catch (error) { assert.equal(error.failureKind, 'coverage_gap') }
  }
})

test('properties of an unrelated nested scope cannot establish the job country', async () => {
  const jobs = await run(html({ country: 'Unknown', extra: '<aside itemscope itemtype="http://schema.org/Organization"><meta itemprop="addressCountry" content="IN"></aside>' }))
  assert.equal(jobs.length, 0)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-location-scope-unresolved'))
})

test('conflicting native microdata URLs stay unresolved instead of falling back to the current page', async () => {
  const jobs = await run(html({ extra: '<a itemprop="url" href="https://example.test/job/123">Role</a><a itemprop="url" href="https://example.test/job/456">Role</a>' }))
  assert.equal(jobs.length, 0)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('ambiguous-native-microdata-url'))
})

test('bounded recruitment discovery checks a declared role before generic career navigation', async () => {
  const jobs = await createVerifiedRecruitmentScraper({ ...source, prioritizeRecruitmentSearch: true }).run({ maxPages: 2,
    now: () => '2026-11-03T14:00:00Z', fetchPage: async requested => ({ status: 200, url: requested,
      html: requested === source.companyCareerPage ? `<h1>Example Careers</h1><a href="/viewalljobs/">All jobs</a><a href="${url}">Graduate Engineer Trainee</a>`
        : requested === url ? html() : '<h1>Search open positions</h1>' }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, url)
})

test('truncated RMK country metadata cannot turn an Indonesian workplace into India', async () => {
  const jobs = await run(html({ country: 'In', extra: '<span class="jobGeoLocation">Verna, Goa, Indonesia</span>' }))
  assert.equal(jobs.length, 0)
  assert.deepEqual(jobs[RECRUITMENT_OBSERVATIONS].unresolved, [])
})

test('correlates RMK full visible country labels while preserving the original shortened metadata', async () => {
  const india = await run(html({ country: 'In', extra: '<span class="jobGeoLocation">Verna, Goa, India</span>' }))
  assert.equal(india.length, 1)
  assert.equal(india[0].nativeSourceRecord.jobLocation[0].address.nativeAddressCountry, 'In')
  const foreign = await run(html({ country: 'Un', extra: '<span class="jobGeoLocation">Verna, Goa, United States, 12345</span>' }))
  assert.equal(foreign.length, 0)
  assert.deepEqual(foreign[RECRUITMENT_OBSERVATIONS].unresolved, [])
})

test('conflicting full and typed microdata countries stay unresolved', async () => {
  const jobs = await run(html({ country: 'US', extra: '<span class="jobGeoLocation">Verna, Goa, India</span>' }))
  assert.equal(jobs.length, 0)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-microdata-country-conflict'))
})

test('explicit visible ISO country fields can corroborate typed country metadata', async () => {
  const jobs = await run(html({ country: 'IN', extra: '<span class="jobGeoLocation">Verna, Goa, IN, 123456</span>' }))
  assert.equal(jobs.length, 1)
  const foreign = await run(html({ country: 'Un', extra: '<span class="jobGeoLocation">Verna, Goa, IN</span>' }))
  assert.equal(foreign.length, 0)
  assert.ok(foreign[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-microdata-country-conflict'))
})

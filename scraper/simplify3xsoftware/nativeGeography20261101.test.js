import fs from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import * as source from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { buildJobDerivedFields } from '../../src/utils/jobDerivedFields.js'

const sha = value => createHash('sha256').update(value).digest('hex')
const provider = getScraperCatalog().find(row => row.source === 'simplify3xsoftware')
assert.ok(provider)
const fixtureRoot = new URL('../../scraper-support/tests/fixtures/simplify3x-current/', import.meta.url)
const texts = Object.fromEntries(['home.html','life.html','about.html','contact.html','careers.html','app.js','careers.js','listing.json','details.json','availability.json'].map(name => [name, fs.readFileSync(new URL(name, fixtureRoot), 'utf8')]))
const listing = JSON.parse(texts['listing.json']), details = JSON.parse(texts['details.json'])
const ID = 'L071122A001CU036JD028'
const nativeRow = listing.data.flatMap(group => group.jobs).find(row => row.jobID === ID)
const nativeDetail = details[ID].body.data
const routes = [['factory', options => source.createSimplify3xSoftwareScraper().run(options)], ['registered', options => createCatalogScraper(provider).run(options)]]
const clone = value => structuredClone(value)
const records = []
const phaseURLs = {
  [source.HOMEPAGE_URL]: 'home.html', [source.LIFE_PAGE_URL]: 'life.html',
  [source.ABOUT_URL]: 'about.html', [source.CONTACT_URL]: 'contact.html',
  [source.CAREERS_URL]: 'careers.html',
  'https://www.hire3x.com/js/app.43b85d23.js': 'app.js',
  'https://www.hire3x.com/js/988.f36977f5.js': 'careers.js',
}

const readModel = ({ location, mode = 'one-role', mismatch = false, missing = false, mutatePage } = {}) => {
  const modelListing = clone(listing), modelDetails = clone(details)
  if (mode === 'one-role') {
    // A cropped one-role envelope is synthetic. The role's original ID,
    // employer/license, title, JD, dates and form remain exact.
    modelListing.data = modelListing.data.map(group => ({ ...group, jobs: group.jobs.filter(row => row.jobID === ID).map(row => clone(row)) })).filter(group => group.jobs.length)
    let retained = false
    for (const group of modelListing.data) group.jobs = group.jobs.filter(() => !retained && (retained = true))
  }
  if (location !== undefined || missing) {
    for (const group of modelListing.data) for (const row of group.jobs) if (row.jobID === ID) {
      if (missing) delete row.location
      else row.location = clone(location)
    }
    if (missing) delete modelDetails[ID].body.data.location
    else modelDetails[ID].body.data.location = mismatch ? ['Boston, Massachusetts, United States'] : clone(location)
  }
  const calls = [], originalInput = JSON.stringify({ modelListing, modelDetails })
  return {
    calls,
    unchanged: () => assert.equal(JSON.stringify({ modelListing, modelDetails }), originalInput),
    fetchPage: async (url, options = {}) => {
      calls.push({ url, callerSignalProvided: Object.hasOwn(options, 'signal') })
      let page
      if (phaseURLs[url]) page = { status: 200, url, html: texts[phaseURLs[url]] }
      else if (url === source.LISTING_URL) page = { status: 200, url, html: JSON.stringify(modelListing) }
      else if (url.startsWith(source.DETAIL_BASE)) {
        const id = new URL(url).searchParams.get('jobID'), item = modelDetails[id]
        assert.ok(item, 'Only exact original detail IDs may be requested')
        page = { status: item.status, url, html: JSON.stringify(item.body) }
      } else if (url.startsWith(source.AVAILABILITY_BASE)) {
        const id = new URL(url).searchParams.get('jobID')
        // This exactly follows the existing support-test typed injection.
        // It is not a claim of a captured availability packet for every ID.
        page = { status: 200, url, html: JSON.stringify({ type: 'Success', data: { JobID: id, customerID: id.split('JD')[0] } }) }
      } else assert.fail('No unmapped/default IO allowed: ' + url)
      mutatePage?.(page, url)
      return page
    },
  }
}

const measure = async (label, model, clock = '2026-10-01T00:00:00.000Z') => {
  const results = []
  for (const [route, execute] of routes) {
    const input = readModel(model)
    try {
      const jobs = await execute({ fetchPage: input.fetchPage, now: () => clock })
      input.unchanged()
      const normalized = jobs.map(job => normalizeScrapedJob(job, provider))
      for (let index = 0; index < jobs.length; index++) {
        assert.deepEqual(normalized[index].rawNativeWorkplaceEvidence, jobs[index].rawNativeWorkplaceEvidence)
        assert.equal(normalized[index].nativeGeographyQualified, jobs[index].nativeGeographyQualified)
      }
      const evidence = readInventoryEvidence(jobs)
      const metrics = analyzePublishableJobs(normalized, { now: new Date(clock) })
      const record = {
        label, route, clock, syntheticEnvelope: model?.mode !== 'full', syntheticLocation: Object.hasOwn(model ?? {}, 'location'),
        rawLocationVariant: model?.location ?? null, calls: input.calls, jobs,
        normalized: normalized.map(job => ({ jobId: job.jobId, title: job.title, country: job.country, city: job.city, state: job.state, location: job.location, postedAt: job.postedAt, sourceDescriptionSHA256: sha(job.sourceDescription ?? ''), nativeGeographyQualified: job.nativeGeographyQualified ?? null, isPublicIndia: buildJobDerivedFields(job).isPublicIndia })),
        inventoryEvidence: evidence, indiaRows: filterIndiaJobs(normalized).length,
        eligibleJobIDs: metrics.eligibleJobs.map(job => job.jobId), filterCounts: metrics.filterCounts,
        verifiedEmpty: isVerifiedEmptyEvidence(evidence), freshComplete: isFreshCompleteInventoryEvidence(evidence, { now: clock }),
      }
      for (const job of jobs.filter(job => job.jobId === ID)) {
        assert.equal(job.title, nativeDetail.title)
        assert.equal(job.postedAt, nativeDetail.createdAt)
        assert.equal(job.applyUrl, 'https://recruitment.hire3x.com/JobRegistration/' + ID)
        assert.equal(job.jobUrl, job.applyUrl); assert.equal(job.sourceUrl, job.applyUrl)
        assert.equal(job.description, nativeDetail.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim())
        assert.equal(job.sourceListingComplete, false)
      }
      assert.equal(evidence.status, 'coverage-gap'); assert.equal(evidence.listingComplete, false)
      assert.equal(evidence.reportedTotal, null); assert.equal(evidence.indiaFacetCount, null)
      assert.equal(record.verifiedEmpty, false); assert.equal(record.freshComplete, false)
      records.push(record); results.push(record)
    } catch (error) {
      input.unchanged()
      const record = { label, route, clock, rawLocationVariant: model?.location ?? null, error: { name: error.name, message: error.message }, calls: input.calls }
      records.push(record); results.push(record)
    }
  }
  return results
}

test('Simplify3x unchanged existing full fixture preserves raw IDs/JDs/dates/partial evidence', async () => {
  const results = await measure('original-full-fixture', { mode: 'full' })
  for (const result of results) {
    assert.equal(result.error, undefined)
    assert.deepEqual(result.jobs.map(row => row.jobId).sort(), ["L071122A001CU009JD010","L071122A001CU009JD012","L071122A001CU009JD013","L071122A001CU009JD014","L071122A001CU009JD015","L071122A001CU010JD017","L071122A001CU036JD027","L071122A001CU036JD028","L071122A001CU036JD029"])
    assert.ok(result.jobs.every(job => job.country === null && job.city === null && job.location === null && job.nativeGeographyQualified === false))
    assert.ok(result.normalized.every(job => job.isPublicIndia === false))
    assert.equal(result.eligibleJobIDs.length, 0)
    assert.equal(result.calls.length, 31)
  }
})

for (const [label, raw] of [['bare Bengaluru', ['Bengaluru']], ['bare Bangalore', ['Bangalore']]]) {
  test('Simplify3x role-owned ' + label + ' cannot establish India at either policy window', async () => {
    const results = []
    for (const clock of ['2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z']) results.push(...await measure(label, { location: raw }, clock))
    for (const result of results) {
      assert.equal(result.error, undefined)
      assert.equal(result.jobs.length, 1)
      assert.equal(result.jobs[0].country, null)
      assert.equal(result.jobs[0].city, null)
      assert.equal(result.jobs[0].location, null); assert.equal(result.jobs[0].state, null)
      assert.equal(Object.hasOwn(result.jobs[0], 'country'), true)
      assert.equal(result.jobs[0].nativeGeographyQualified, false)
      assert.deepEqual(result.jobs[0].rawNativeWorkplaceEvidence.locations, raw)
      assert.equal(result.normalized[0].isPublicIndia, false)
      assert.equal(result.eligibleJobIDs.length, 0)
    }
  })
}

for (const [label, raw, countryOnly] of [['explicit role India', ['Bengaluru, India'], false], ['country-only India', ['India'], true]]) {
  test('Simplify3x ' + label + ' remains a healthy bound role without an invented city', async () => {
    const results = await measure(label, { location: raw })
    for (const result of results) {
      assert.equal(result.error, undefined)
      assert.equal(result.jobs.length, 1)
      assert.equal(result.jobs[0].country, 'India')
      if (countryOnly) assert.equal(result.jobs[0].city, null)
    }
  })
}

for (const [label, raw] of [
  ['explicit native US', ['Boston, Massachusetts, United States']],
  ['native Malaysia', ['Malaysia']],
  ['mixed role countries', ['Bengaluru', 'United States']],
  ['missing native locations', []],
]) test('Simplify3x ' + label + ' never creates public India or complete-empty authority', async () => {
  const results = await measure(label, { location: raw })
  for (const result of results) {
    assert.equal(result.error, undefined)
    if (label === 'mixed role countries' || label === 'missing native locations') {
      assert.equal(result.jobs.length, 1)
      assert.equal(result.jobs[0].nativeGeographyQualified, false)
      assert.deepEqual(result.jobs[0].rawNativeWorkplaceEvidence.locations, raw)
      assert.equal(result.jobs[0].country, null); assert.equal(result.jobs[0].location, null)
    }
    assert.equal(result.indiaRows, 0)
    assert.equal(result.eligibleJobIDs.length, 0)
    assert.equal(result.verifiedEmpty, false)
  }
})

for (const [label, model, pattern] of [
  ['listing/detail workplace conflict', { location: ['Bengaluru'], mismatch: true }, /location mismatch/],
  ['missing workplace schema', { missing: true }, /identity/],
  ['foreign final company URL', { mutatePage: (page, url) => { if (url === source.HOMEPAGE_URL) page.url = 'https://foreign.example/' } }, /redirect/],
  ['foreign employer license', { mutatePage: (page, url) => { if (url === source.LISTING_URL) { const body = JSON.parse(page.html); body.data[0].jobs[0].licenseKey = 'L999999A001'; page.html = JSON.stringify(body) } } }, /identity|license/],
]) test('Simplify3x retains strict ' + label + ' rejection', async () => {
  const results = await measure(label, model)
  for (const result of results) {
    assert.match(result.error?.message ?? '', pattern)
    assert.equal(result.calls.some(call => call.url.startsWith(source.AVAILABILITY_BASE)), false)
  }
})


test('Simplify3x non-Bengaluru explicit-country workplace never inherits a hardcoded city', async () => {
  const results = await measure('explicit Mumbai India', { location: ['Mumbai, India'] })
  for (const result of results) {
    assert.equal(result.error, undefined); assert.equal(result.jobs.length, 1)
    assert.equal(result.jobs[0].country, 'India'); assert.equal(result.jobs[0].city, null)
    assert.equal(result.jobs[0].location, 'Mumbai, India'); assert.equal(result.jobs[0].nativeGeographyQualified, true)
    assert.deepEqual(result.jobs[0].rawNativeWorkplaceEvidence.locations, ['Mumbai, India'])
  }
})

test('Simplify3x unsupported native location members remain raw without country string coercion', async () => {
  for (const raw of [['India', {}], [null], [true], [['Bengaluru', 'India']]]) {
    for (const result of await measure('unsupported location member', { location: raw })) {
      assert.equal(result.error, undefined); assert.equal(result.jobs.length, 1)
      assert.equal(result.jobs[0].country, null); assert.equal(result.jobs[0].city, null); assert.equal(result.jobs[0].location, null)
      assert.equal(result.jobs[0].nativeGeographyQualified, false)
      assert.deepEqual(result.jobs[0].rawNativeWorkplaceEvidence.locations, raw)
      assert.equal(result.indiaRows, 0); assert.equal(result.eligibleJobIDs.length, 0)
    }
  }
})

test('Simplify3x mixed named countries and terminal codes remain unqualified', async () => {
  for (const raw of [['USA, Chennai, IN'], ['Chennai, India, Boston, US']]) {
    for (const result of await measure('mixed native country tokens', { location: raw })) {
      assert.equal(result.error, undefined); assert.equal(result.jobs.length, 1)
      assert.equal(result.jobs[0].country, null); assert.equal(result.jobs[0].location, null)
      assert.equal(result.jobs[0].nativeGeographyQualified, false)
      assert.deepEqual(result.jobs[0].rawNativeWorkplaceEvidence.locations, raw)
      assert.equal(result.indiaRows, 0); assert.equal(result.eligibleJobIDs.length, 0)
    }
  }
})

test('Simplify3x explicit-country role keeps native posting date at both real policy windows', async () => {
  for (const clock of ['2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z']) {
    for (const result of await measure('explicit country date boundary', { location: ['Bengaluru, India'] }, clock)) {
      assert.equal(result.error, undefined); assert.equal(result.jobs.length, 1)
      assert.equal(result.jobs[0].postedAt, nativeDetail.createdAt)
      assert.equal(result.normalized[0].postedAt.toISOString(), '2026-09-30T16:09:34.913Z')
      assert.equal(result.jobs[0].country, 'India'); assert.equal(result.jobs[0].city, null)
      assert.equal(result.indiaRows, 1); assert.equal(result.normalized[0].isPublicIndia, true)
      assert.equal(result.eligibleJobIDs.length, clock.startsWith('2026-10') ? 1 : 0)
      assert.equal(result.filterCounts.old, clock.startsWith('2026-10') ? 0 : 1)
    }
  }
})

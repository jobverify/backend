import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createQuadEyeScraper, extractIndiaJobs, CAREERS_PAGE_URL, CAREERS_PORTAL_URL, CAREERS_API_URL } from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { buildJobDerivedFields } from '../../src/utils/jobDerivedFields.js'
import { readInventoryEvidence, isCompleteScraperAttempt } from '../../scraper-support/utils/inventoryEvidence.js'
import { buildScraperAttemptDiagnostics, isAuthoritativeEmptyScrape } from '../../scraper-support/runner.js'
import { finishScraperProcessing, inventoryCleanupOptions } from '../../scraper-support/utils/scraperOutcome.js'

const payload = JSON.parse(readFileSync(new URL('../../scraper-support/tests/fixtures/quadeye/current-api.json', import.meta.url), 'utf8'))
const provider = getScraperCatalog().find(row => row.source === 'quadeye')
const sourceClock = '2026-11-01T00:00:00.000Z' // Synthetic transport clock; the API fixture supplies no qualified response clock.
const recentWindow = new Date('2026-08-12T00:00:00.000Z') // Isolates geography without changing native Date_Opened.
const oldWindow = new Date('2026-11-01T00:00:00.000Z')
const home = '<title>Jobs | quadeye</title><link rel="canonical" href="https://www.quadeye.com/jobs"><a href="/career">Careers</a><a href="/contact-us">Contact</a><h2>Open Roles</h2>Loading roles'
const portal = data => '<title>Jobs at PeoplePlus</title><meta property="og:url" content="https://quadeye.zohorecruit.in/jobs/Careers/"><meta property="og:site_name" content="Quadeye"><input id="pageJson"><input id="moduleMeta"><input id="jobs" value="' + JSON.stringify(data.data.map(row => ({ id: row.id }))).replaceAll('"', '&quot;') + '">'
const rawWorkplace = row => Object.fromEntries(['Country', 'Job_Location', 'City', 'State'].filter(key => Object.hasOwn(row, key)).map(key => [key, structuredClone(row[key])]))
const one = change => { const data = structuredClone(payload); data.data = [data.data[0]]; change?.(data.data[0]); return data }
const run = async (route, data, maxJobs = null) => {
  const snapshot = structuredClone(data), requests = []
  const options = {
    now: () => sourceClock,
    fetchText: async url => {
      requests.push(url)
      if (url === CAREERS_PAGE_URL) return home
      if (url === CAREERS_PORTAL_URL) return portal(data)
      const row = data.data.find(row => row.$url === url)
      assert.ok(row, 'Only a retained advertised role URL may be read')
      return '<title>Quadeye</title><h1>' + row.Posting_Title + '</h1>'
    },
    fetchJson: async url => { requests.push(url); assert.equal(url, CAREERS_API_URL); return data },
  }
  const jobs = route === 'extract' ? extractIndiaJobs(data)
    : await (route === 'factory' ? createQuadEyeScraper({ maxJobs }) : createCatalogScraper(provider)).run(options)
  assert.deepEqual(data, snapshot, 'Native input must remain unchanged')
  return { jobs, requests }
}
const assertUnknown = (job, native) => {
  for (const field of ['country', 'location', 'city', 'state']) {
    assert.equal(Object.hasOwn(job, field), true, field + ' must explicitly retain unknown')
    assert.equal(job[field], null, field)
  }
  assert.equal(job.nativeGeographyQualified, false)
  assert.deepEqual(job.rawNativeWorkplaceEvidence, rawWorkplace(native))
  assert.equal(job.jobId, native.id)
  assert.equal(job.requisitionId, native.id)
  assert.equal(job.sourceUrl, native.$url)
  assert.equal(job.applyUrl, native.$url)
  const normalized = normalizeScrapedJob(job, provider)
  for (const candidate of [job, normalized]) {
    assert.equal(candidate.country, null)
    assert.equal(candidate.location, null)
    assert.equal(filterIndiaJobs([candidate]).length, 0)
    assert.equal(buildJobDerivedFields(candidate).isPublicIndia, false)
    assert.equal(analyzePublishableJobs([candidate], { now: recentWindow }).eligibleJobs.length, 0)
    assert.equal(analyzePublishableJobs([candidate], { now: oldWindow }).eligibleJobs.length, 0)
  }
}
const assertPartial = jobs => {
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, null)
  const metrics = analyzePublishableJobs(jobs, { now: oldWindow })
  const diagnostics = buildScraperAttemptDiagnostics(jobs, metrics, provider)
  assert.equal(isCompleteScraperAttempt({ success: true, ...diagnostics, completedAt: sourceClock }), false)
  assert.deepEqual(inventoryCleanupOptions(diagnostics), { replaceExisting: false })
  assert.equal(finishScraperProcessing({ success: true, ...diagnostics, completedAt: sourceClock }).partial, true)
  assert.equal(isAuthoritativeEmptyScrape({ name: provider.source, provider }, jobs), false)
  for (const job of jobs) {
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceGlobalJobCount, null)
    assert.equal(job.sourceIndiaJobCount, null)
    assert.equal(job.scrapedAt, sourceClock)
  }
}

// These decisions describe the original native fields, not a live inventory or employer approval.
const nativeDecisions = [
  ['199893000002318440', 'india'], ['199893000002318430', 'india'], ['199893000002318371', 'india'],
  ['199893000001828092', 'foreign'], ['199893000000742323', 'india'], ['199893000000707783', 'india'],
  ['199893000000440330', 'unknown'], ['199893000000440283', 'india'], ['199893000002926019', 'india'],
  ['199893000002560787', 'india'], ['199893000001636214', 'unknown'], ['199893000001635119', 'foreign'],
  ['199893000000497003', 'unknown'], ['199893000003455803', 'foreign'], ['199893000000864279', 'india'],
  ['199893000000441154', 'foreign'], ['199893000000441108', 'unknown'], ['199893000000441067', 'unknown'],
  ['199893000000441036', 'unknown'], ['199893000000441005', 'unknown'], ['199893000000440465', 'unknown'],
  ['199893000000440427', 'unknown'], ['199893000000440389', 'unknown'], ['199893000000440363', 'unknown'],
  ['199893000000419219', 'unknown'],
]
test('QuadEye retained feed decisions use each complete native Country and all locations', async () => {
  assert.deepEqual(payload.data.map(row => row.id), nativeDecisions.map(([id]) => id))
  const expectedIds = nativeDecisions.filter(([, decision]) => decision !== 'foreign').map(([id]) => id)
  for (const route of ['extract', 'factory', 'registry']) {
    const { jobs, requests } = await run(route, payload)
    assert.deepEqual(jobs.map(row => row.jobId), expectedIds)
    for (const [id, decision] of nativeDecisions) {
      const raw = payload.data.find(row => row.id === id), job = jobs.find(row => row.jobId === id)
      if (decision === 'foreign') assert.equal(job, undefined)
      else if (decision === 'unknown') assertUnknown(job, raw)
      else { assert.equal(job.country, 'India'); assert.equal(job.location, 'Gurugram, India'); assert.equal(job.sourceUrl, raw.$url) }
    }
    if (route !== 'extract') { assertPartial(jobs); assert.equal(requests.length, 4) }
  }
})

const unknownCases = [
  ['US with bare Gurugram', row => { row.Country = 'US'; row.Job_Location = ['Gurugram'] }],
  ['United States with explicit India location', row => { row.Country = 'United States'; row.Job_Location = ['Gurugram, India'] }],
  ['unrecognized Country', row => { row.Country = 'ZZ'; row.Job_Location = ['Gurugram'] }],
  ['mixed Country', row => { row.Country = 'India, United States'; row.Job_Location = ['Gurugram'] }],
  ['non-string Country', row => { row.Country = ['India']; row.Job_Location = ['Gurugram'] }],
  ['null Country and bare Gurugram', row => { row.Country = null; row.Job_Location = ['Gurugram'] }],
  ['absent Country and bare Gurgaon', row => { delete row.Country; row.Job_Location = ['Gurgaon'] }],
  ['blank Country and mixed explicit/bare India locations', row => { row.Country = ''; row.Job_Location = ['Gurugram, India', 'Gurgaon'] }],
  ['India Country with an additional foreign location', row => { row.Country = 'India'; row.Job_Location = ['Gurugram', 'New York'] }],
  ['foreign locations disagree with provided foreign Country', row => { row.Country = 'Singapore'; row.Job_Location = ['Singapore', 'Hong Kong', 'South Korea'] }],
  ['blank Country with multiple explicit foreign countries', row => { row.Country = null; row.Job_Location = ['Romania', 'Singapore'] }],
  ['unknown location Remote', row => { row.Country = null; row.Job_Location = ['Remote'] }],
  ['blank location entry', row => { row.Country = 'India'; row.Job_Location = ['Gurugram', ''] }],
  ['unsupported native location value', row => { row.Country = 'India'; row.Job_Location = [{ name: 'Gurugram' }] }],
  ['fallback City conflicts with explicit India', row => { row.Country = 'India'; delete row.Job_Location; row.City = 'New York'; row.State = null }],
]
for (const [name, change] of unknownCases) test('QuadEye keeps unqualified geography raw: ' + name, async () => {
  const data = one(change)
  for (const route of ['extract', 'factory', 'registry']) {
    const { jobs } = await run(route, data)
    assert.equal(jobs.length, 1, 'A genuine bound role remains an observation')
    assertUnknown(jobs[0], data.data[0])
    assert.equal(jobs[0].postingDate, '2026-08-11T00:00:00.000Z')
    if (route !== 'extract') assertPartial(jobs)
  }
})
for (const [name, change] of [
  ['explicit Country India and bare native city', row => { row.Country = 'India'; row.Job_Location = ['Gurugram'] }],
  ['explicit native country suffix without Country', row => { row.Country = null; row.Job_Location = ['Gurugram, India'] }],
  ['matching India code and two India worksites', row => { row.Country = 'IN'; row.Job_Location = ['Gurugram', 'Gurgaon'] }],
  ['existing explicit Country and fallback City/State', row => { row.Country = 'India'; delete row.Job_Location }],
]) test('QuadEye preserves supported India role: ' + name, async () => {
  const data = one(change)
  for (const route of ['extract', 'factory', 'registry']) {
    const { jobs } = await run(route, data)
    assert.equal(jobs.length, 1)
    for (const job of [jobs[0], normalizeScrapedJob(jobs[0], provider)]) {
      assert.equal(job.country, 'India')
      assert.equal(buildJobDerivedFields(job).isPublicIndia, true)
      assert.equal(analyzePublishableJobs([job], { now: recentWindow }).eligibleJobs.length, 1)
      const old = analyzePublishableJobs([job], { now: oldWindow })
      assert.equal(old.eligibleJobs.length, 0)
      assert.equal(old.filterCounts.old, 1)
    }
    if (route !== 'extract') assertPartial(jobs)
  }
})
test('QuadEye retains healthy adjacent roles and unknown observations without creating empty authority', async () => {
  const data = one()
  data.data[0].Country = 'India'; data.data[0].Job_Location = ['Gurugram']
  const unknown = structuredClone(payload.data[1]); unknown.Country = null; unknown.Job_Location = ['Gurugram']; data.data.push(unknown)
  for (const route of ['factory', 'registry']) {
    const { jobs } = await run(route, data)
    assert.deepEqual(jobs.map(row => row.jobId), data.data.map(row => row.id))
    assert.equal(jobs[0].country, 'India'); assertUnknown(jobs[1], unknown)
    const normalized = jobs.map(row => normalizeScrapedJob(row, provider))
    assert.equal(analyzePublishableJobs(normalized, { now: recentWindow }).eligibleJobs.length, 1)
    assertPartial(jobs)
  }
})
test('QuadEye consistent foreign-only data remains a coverage gap rather than verified empty', async () => {
  const data = structuredClone(payload)
  data.data = payload.data.filter(row => ['199893000001828092', '199893000001635119', '199893000003455803', '199893000000441154'].includes(row.id))
  for (const route of ['factory', 'registry']) {
    const { jobs, requests } = await run(route, data)
    assert.deepEqual(jobs, [])
    assert.equal(requests.length, 3)
    assertPartial(jobs)
  }
})
test('QuadEye cap keeps full portal identity checks and incomplete source scope', async () => {
  const { jobs, requests } = await run('factory', payload, 2)
  assert.equal(jobs.length, 2); assert.equal(requests.length, 4); assertPartial(jobs)
  const data = one(row => { row.Country = null; row.Job_Location = ['Gurugram'] })
  const invalid = structuredClone(data.data[0]); invalid.id = ''; data.data.push(invalid)
  await assert.rejects(run('factory', data, 1), /incomplete|identity|application/i)
})
test('QuadEye unknown geography never bypasses native identity and application checks', () => {
  for (const change of [row => { row.id = '' }, row => { row.$url = 'https://unrelated.example/job' }, row => { row.Posting_Title = ''; row.Job_Opening_Name = '' }]) {
    const data = one(row => { row.Country = null; row.Job_Location = ['Gurugram']; change(row) })
    assert.throws(() => extractIndiaJobs(data), /incomplete|identity|application/i)
  }
  const data = one(row => { row.Country = null; row.Job_Location = ['Gurugram'] })
  data.data.push(structuredClone(data.data[0]))
  assert.throws(() => extractIndiaJobs(data), /incomplete|identity|application/i)
})

// Independent reviewer six-case follow-up. Only its backend locator is portable;
// original callbacks/assertions and the preceding 24 controls remain exact.
{
const fs = await import('node:fs')
const crypto = await import('node:crypto')
const { after } = await import('node:test')
const { fileURLToPath } = await import('node:url')
const backend = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '')
const payload = JSON.parse(fs.readFileSync(backend + '/scraper-support/tests/fixtures/quadeye/current-api.json', 'utf8'))
const provider = getScraperCatalog().find(row => row.source === 'quadeye')
const recentWindow = new Date('2026-08-12T00:00:00.000Z') // Synthetic comparison window; native August 11 date is unchanged.
const oldWindow = new Date('2026-11-01T00:00:00.000Z')
const syntheticTransportClock = '2026-11-01T00:00:00.000Z'
const home = '<title>Jobs | quadeye</title><link rel="canonical" href="https://www.quadeye.com/jobs"><a href="/career">Careers</a><a href="/contact-us">Contact</a><h2>Open Roles</h2>Loading roles'
const portal = data => '<title>Jobs at PeoplePlus</title><meta property="og:url" content="https://quadeye.zohorecruit.in/jobs/Careers/"><meta property="og:site_name" content="Quadeye"><input id="pageJson"><input id="moduleMeta"><input id="jobs" value="' + JSON.stringify(data.data.map(row => ({ id: row.id }))).replaceAll('"', '&quot;') + '">'
const rawWorkplace = row => Object.fromEntries(['Country', 'Job_Location', 'City', 'State'].filter(key => Object.hasOwn(row, key)).map(key => [key, structuredClone(row[key])]))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const invariantFields = ['title', 'company', 'department', 'jobId', 'requisitionId', 'sourceUrl', 'applyUrl', 'employmentType', 'experienceRequired', 'minimumQualification', 'preferredQualification', 'requiredSkills', 'postingDate', 'closingDate', 'jobDescription', 'remoteStatus']
const baseline = extractIndiaJobs({ ...payload, data: [structuredClone(payload.data[0])] })[0]
const baselineCore = Object.fromEntries(invariantFields.map(key => [key, baseline[key]]))
const observations = []
after(() => {
  if (process.env.QUADEYE_REVIEW_RESULTS) fs.writeFileSync(process.env.QUADEYE_REVIEW_RESULTS, JSON.stringify({
    source: 'quadeye', candidate: '7cdbbe344df46ac6ccde9ea0d4c96735c054935b36ddcc2aaadd66fdeaae72f6',
    fixtureKind: 'One-row controlled envelope around the unchanged first archived native role; mutations are synthetic.',
    originalDateOpened: payload.data[0].Date_Opened, originalId: payload.data[0].id,
    originalRawDescriptionSha256: sha(payload.data[0].Job_Description), originalRawWorkplace: rawWorkplace(payload.data[0]),
    recentComparisonClock: recentWindow.toISOString(), oldComparisonClock: oldWindow.toISOString(),
    syntheticTransportClock, observations,
  }, null, 2) + '\n')
})

const execute = async (name, change) => {
  const data = structuredClone(payload)
  data.data = [data.data[0]]
  change?.(data.data[0])
  const snapshot = structuredClone(data)
  const reports = []
  for (const route of ['extract', 'factory', 'registry']) {
    const requests = []
    const options = {
      now: () => syntheticTransportClock,
      fetchText: async url => {
        requests.push({ method: 'GET', kind: 'controlled-text', url })
        if (url === CAREERS_PAGE_URL) return home
        if (url === CAREERS_PORTAL_URL) return portal(data)
        assert.equal(url, data.data[0].$url, 'Only the literal retained role application/detail URL may be read')
        return '<title>Quadeye</title><h1>' + data.data[0].Posting_Title + '</h1>'
      },
      fetchJson: async url => {
        requests.push({ method: 'GET', kind: 'controlled-json', url })
        assert.equal(url, CAREERS_API_URL)
        return data
      },
    }
    const jobs = route === 'extract' ? extractIndiaJobs(data)
      : await (route === 'factory' ? createQuadEyeScraper() : createCatalogScraper(provider)).run(options)
    assert.deepEqual(data, snapshot, 'The native role/date/JD and controlled input must remain unmodified')
    const evidence = readInventoryEvidence(jobs)
    if (route !== 'extract') {
      assert.equal(evidence?.status, 'coverage-gap')
      assert.equal(evidence.listingComplete, false)
      assert.equal(evidence.reportedTotal, null)
      assert.equal(evidence.indiaFacetCount, null)
      assert.equal(evidence.verifiedAt, null)
    }
    assert.equal(requests.length, route === 'extract' ? 0 : jobs.length ? 4 : 3)
    const report = { route, count: jobs.length, requests, inventoryEvidence: evidence || null }
    if (jobs[0]) {
      const job = jobs[0]
      const actualCore = Object.fromEntries(invariantFields.map(key => [key, job[key]]))
      assert.deepEqual(actualCore, baselineCore, 'Geographic mutations must not alter role identity, full JD, dates, application, or other native fields')
      assert.equal(job.postingDate, '2026-08-11T00:00:00.000Z')
      const normalized = normalizeScrapedJob(job, provider)
      report.job = {
        country: job.country, location: job.location, city: job.city, state: job.state,
        nativeGeographyQualified: job.nativeGeographyQualified ?? null,
        ownNullGeography: ['country', 'location', 'city', 'state'].every(key => Object.hasOwn(job, key) && job[key] === null),
        rawNativeWorkplaceEvidence: job.rawNativeWorkplaceEvidence || null,
        rawEvidenceExact: JSON.stringify(job.rawNativeWorkplaceEvidence) === JSON.stringify(rawWorkplace(data.data[0])),
        invariantFieldsExact: true, postingDate: job.postingDate,
        jobDescriptionSha256: sha(job.jobDescription),
      }
      report.normalized = {
        country: normalized.country, location: normalized.location,
        publicIndia: buildJobDerivedFields(normalized).isPublicIndia,
        indiaFilterCount: filterIndiaJobs([normalized]).length,
        recentEligible: analyzePublishableJobs([normalized], { now: recentWindow }).eligibleJobs.length,
        oldEligible: analyzePublishableJobs([normalized], { now: oldWindow }).eligibleJobs.length,
        oldCount: analyzePublishableJobs([normalized], { now: oldWindow }).filterCounts.old,
      }
    }
    reports.push(report)
  }
  observations.push({ name, nativeWorkplace: rawWorkplace(data.data[0]), nativeDateOpened: data.data[0].Date_Opened, reports })
  return reports
}

const assertUnknown = reports => {
  assert.deepEqual(reports.map(report => ({
    route: report.route, count: report.count,
    ownNullGeography: report.job?.ownNullGeography ?? false,
    nativeGeographyQualified: report.job?.nativeGeographyQualified ?? null,
    rawEvidenceExact: report.job?.rawEvidenceExact ?? false,
    normalizedCountry: report.normalized?.country ?? null,
    normalizedLocation: report.normalized?.location ?? null,
    publicIndia: report.normalized?.publicIndia ?? false,
    indiaFilterCount: report.normalized?.indiaFilterCount ?? 0,
    recentEligible: report.normalized?.recentEligible ?? 0,
  })), ['extract', 'factory', 'registry'].map(route => ({
    route, count: 1, ownNullGeography: true, nativeGeographyQualified: false,
    rawEvidenceExact: true, normalizedCountry: null, normalizedLocation: null,
    publicIndia: false, indiaFilterCount: 0, recentEligible: 0,
  })), 'All provided native workplace fields must be reconciled before qualification or foreign filtering')
}

test('QuadEye native first-row healthy Country/Job_Location/City/State remains eligible in a controlled recent window', async () => {
  const reports = await execute('healthy retained first native row')
  for (const report of reports) {
    assert.equal(report.count, 1)
    assert.equal(report.job.country, 'India')
    assert.equal(report.normalized.publicIndia, true)
    assert.equal(report.normalized.indiaFilterCount, 1)
    assert.equal(report.normalized.recentEligible, 1)
    assert.equal(report.normalized.oldEligible, 0)
    assert.equal(report.normalized.oldCount, 1)
  }
})
for (const [name, change] of [
  ['provided City and State conflict with the India workplace', row => { row.City = 'New York'; row.State = 'New York' }],
  ['provided City alone conflicts with Job_Location while State remains native Haryana', row => { row.City = 'New York' }],
  ['provided State alone conflicts while City remains native Gurgaon', row => { row.State = 'New York' }],
]) test('QuadEye preserves unknown raw role when ' + name, async () => assertUnknown(await execute(name, change)))

test('QuadEye consistent explicit United States/New York controlled workplace is filtered without empty authority', async () => {
  const reports = await execute('consistent explicit foreign fields', row => {
    row.Country = 'United States'; row.Job_Location = ['New York']; row.City = 'New York'; row.State = 'New York'
  })
  assert.deepEqual(reports.map(report => report.count), [0, 0, 0])
})
test('QuadEye retains contradictory foreign Country/Job_Location plus native Gurgaon/Haryana as unknown raw role', async () => {
  assertUnknown(await execute('foreign branch conflicts with retained City/State', row => {
    row.Country = 'United States'; row.Job_Location = ['New York']
  }))
})

}

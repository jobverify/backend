import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as capital from '../../scraper/capitalnumbersinfotech/script.js'
import * as systech from '../../scraper/systechsolutions/script.js'
import * as threePillar from '../../scraper/3pillarglobal/script.js'
import { buildScrapers } from '../providers/index.js'
import { isIndiaJob } from '../utils/indiaLocationFilter.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'

const capitalHtml = readFileSync(new URL('./fixtures/capitalnumbersinfotech/current-openings.html', import.meta.url), 'utf8')
const systechHtml = `<title>Careers at Systech \u2013 Data, AI &amp; Analytics Roles \u2013 Systech Solutions</title>
<p>Open positions &amp; life at Systech</p><p>See open roles</p><p>US Job Openings</p><p>Chennai, India</p>
<script>fetch("${systech.JOBS_LIST_API_URL}");fetch("${systech.JOBS_DETAIL_API_URL}")</script>`
const systechJob = { cr21b_jobid: 'c2afe061-06a6-f111-b8de-70a8a59bac0b', cr21b_jobname: 'Platform Administrator (Alteryx)', cr21b_minyearsofexperience: 3 }
const threePillarCareers = `<title>3Pillar Career Opportunities</title><a href="${threePillar.DARWINBOX_BOARD_URL}">View Opportunities</a>`
const threePillarJob = id => ({
  id, title: 'Software Engineer ' + id, locations: 'Chennai, India', country: 'India',
  jd: '<p>Build and test reliable software services with the engineering team.</p>',
})
const runThreePillar = (payload, options = {}) => threePillar.run({
  fetchImpl: async () => assert.fail('Injected native fixtures must not use real transport'),
  fetchText: async url => {
    assert.equal(url, threePillar.CAREERS_URL)
    return threePillarCareers
  },
  fetchListingPage: async () => payload,
  ...options,
})

test('Capital Numbers publishes all four verified current public role cards', async () => {
  const jobs = await capital.run({ fetchText: async () => capitalHtml })
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.jobId), ['senior-full-stack-data-engineer', 'sales-development-representative', 'technical-project-manager', 'technical-architect-ai-engineering'])
  assert.equal(jobs[0].title, 'Senior Full Stack Data Engineer')
  assert.equal(jobs[0].source, 'capitalnumbersinfotech')
  assert.equal(jobs[0].applyUrl, 'https://www.capitalnumbers.com/careers/senior-full-stack-data-engineer')
})

test('Capital Numbers rejects an incomplete reported listing', async () => {
  await assert.rejects(capital.run({ fetchText: async () => capitalHtml.replace('4 open positions', '5 open positions') }), /incomplete/i)
})

test('Capital Numbers does not silently drop a malformed role card', async () => {
  await assert.rejects(capital.run({ fetchText: async () => capitalHtml.replace('Senior Full Stack Data Engineer', '') }), /incomplete/i)
})

test('Capital Numbers does not relabel a foreign role as India', () => {
  const jobs = capital.extractJobs(capitalHtml.replace('Hyderabad', 'New York, United States'))
  assert.equal(isIndiaJob(jobs[0]), false)
  assert.notEqual(jobs[0].country, 'India')
})

test('Systech accepts valid nonempty public jobs without inventing India location', async () => {
  const jobs = await systech.run({ fetchText: async () => systechHtml, fetchJson: async () => [systechJob] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Platform Administrator (Alteryx)')
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].location, null)
  assert.equal(isIndiaJob(jobs[0]), false)
  assert.equal(new URL(jobs[0].applyUrl).searchParams.get('jobId'), 'c2afe061-06a6-f111-b8de-70a8a59bac0b')
})

test('Systech rejects a partially malformed jobs payload', async () => {
  await assert.rejects(systech.run({ fetchText: async () => systechHtml, fetchJson: async () => [systechJob, { unknown: true }] }), /incomplete/i)
})

test('3Pillar accepts only an explicit native zero as a verified empty inventory', async () => {
  const jobs = await runThreePillar({ status: 'success', job_counts: 0, data: [] })
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'verified-empty')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 0)
  const unknown = await runThreePillar({ status: 'success', data: [] })
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(unknown)), false)
})

test('3Pillar rejects malformed native inventories and propagates denied listings', async () => {
  for (const payload of [[], { error: 'unavailable' },
    { status: 'error', job_counts: 0, data: [] },
    { status: 'success', job_counts: 1, data: [{ title: 'Engineer', locations: 'Chennai, India' }] },
  ]) await assert.rejects(runThreePillar(payload), /malformed or incomplete/i)
  const denied = Object.assign(new Error('HTTP 403'), { status: 403 })
  await assert.rejects(runThreePillar(null, { fetchListingPage: async () => { throw denied } }),
    error => error.failureKind === 'blocked_or_access_denied')
})

test('Script adapter preserves explicitly unknown country before the India filter', async () => {
  const source = buildScrapers().find(item => item.name === 'systechsolutions')
  const jobs = await source.run({ fetchText: async () => systechHtml, fetchJson: async () => [systechJob] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, null)
  assert.equal(isIndiaJob(jobs[0]), false)
})

test('3Pillar caller limits cannot mark a truncated native listing complete', async () => {
  const jobs = await runThreePillar({ status: 'success', job_counts: 2,
    data: [threePillarJob('one'), threePillarJob('two')],
  }, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'one')
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), false)
})

test('3Pillar invalid caller caps never become successful empty snapshots', async () => {
  for (const maxJobs of [0, -1, NaN, 1.5]) {
    await assert.rejects(async () => threePillar.createThreePillarGlobalScraper({ maxJobs }).run({ fetchText: async () => { throw new Error('Transport must not run') } }), /maxJobs.*positive integer|invalid.*limit/i)
  }
})

test('3Pillar short and repeated native inventories stay partial while complete roles retain identity', async () => {
  await assert.rejects(runThreePillar({ status: 'success', job_counts: 2, data: [] }), /malformed or incomplete/i)
  const short = await runThreePillar({ status: 'success', job_counts: 2, data: [threePillarJob('one')] })
  assert.equal(short.length, 1)
  assert.equal(short[0].sourceListingComplete, false)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(short)), false)
  const repeated = await runThreePillar(null, { pageSize: 1,
    fetchListingPage: async () => ({ status: 'success', job_counts: 2, data: [threePillarJob('one')] }),
  })
  assert.equal(readInventoryEvidence(repeated).pagesFetched, 2)
  assert.ok(repeated.every(job => job.sourceListingComplete === false))
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(repeated)), false)
  const complete = await runThreePillar({ status: 'success', job_counts: 2,
    data: [threePillarJob('one'), threePillarJob('two')],
  })
  assert.deepEqual(complete.map(job => job.jobId), ['one', 'two'])
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(complete)), true)
  for (const job of complete) {
    assert.equal(job.source, '3pillarglobal')
    assert.equal(job.company, '3Pillar Global')
    assert.equal(job.country, 'India')
    assert.equal(job.atsPlatform, 'darwinbox')
    assert.equal(job.sourceUrl, `https://3pillar.darwinbox.com/ms/candidatev2/main/careers/jobDetails/${job.jobId}`)
    assert.match(job.jobDescription, /Build and test reliable software services/)
  }
})

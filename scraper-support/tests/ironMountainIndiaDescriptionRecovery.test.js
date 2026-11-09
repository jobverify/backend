import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as source from '../../scraper/ironmountainindia/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { getScraperCatalog } from '../providers/index.js'

const fixture = guid => JSON.parse(readFileSync(new URL(`./fixtures/ironmountainindia/native-${guid}-20261024.json`, import.meta.url)))
const india = fixture('3E5B9F4951D04C2B88CB21B5658F3CC1')
const multi = fixture('60603B3B91B24C10B1A347BF7944B439')
const denied = fixture('A4412DFFE4634350BAF4FEF61347DFF7')
const clock = () => '2026-10-24T18:32:19.000Z'
const board = '<title>Home | Iron Mountain</title><script>window.__NUXT__={};window.__NUXT__.config={public:{"job-folder":"ironmountain-jobs",source:"solr","x-origin":"ironmountain.jobs"}};</script>'
const shell = board + '<script id="__NUXT_DATA__" type="application/json">[{"serverRendered":false}]</script>'
const sitemap = samples => '<urlset>' + samples.map(s => `<url><loc>${s.entry.url}</loc><lastmod>${s.entry.lastmod}</lastmod></url>`).join('') + '</urlset>'
const route = (samples, url) => {
  if (url === source.ABOUT_PAGE_URL) return { status: 429, url, html: '<title>Vercel Security Checkpoint</title><h1>Vercel Security Checkpoint</h1>' }
  if (url === source.CAREERS_URL) return { status: 200, url, html: board }
  if (url === source.JOBS_SITEMAP_URL) return { status: 200, url, html: sitemap(samples) }
  for (const sample of samples) {
    if (url === sample.entry.url) return { status: 200, url, html: shell }
    if (url === sample.nativeDataUrl) return { status: 200, url, html: JSON.stringify(sample.nlx) }
    if (url === sample.nlx.link) return sample.applyReceipt
    if (url === sample.cxsUrl) return { status: sample.cxsStatus, url, html: JSON.stringify(sample.cxs) }
  }
  throw Error('Unexpected native Iron request ' + url)
}
const execute = (samples = [india], options = {}) => source.run({ now: clock, requestIntervalMs: 0,
  fetchPage: async url => route(samples, url), ...options,
})

test('actual Iron native role retains the original primary JD HTML, publication date and distinct source clocks', async () => {
  const jobs = await execute()
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, india.guid)
  assert.equal(job.requisitionId, 'J0103422')
  assert.equal(job.title, india.cxs.jobPostingInfo.title)
  assert.equal(job.jobDescription, india.cxs.jobPostingInfo.jobDescription)
  assert.equal(job.sourceDescription, india.cxs.jobPostingInfo.jobDescription)
  assert.equal(job.jobDescriptionHtml, india.cxs.jobPostingInfo.jobDescription)
  assert.equal(job.postingDate, '2026-09-30')
  assert.equal(job.sourceUrl, india.entry.url)
  assert.equal(job.applyUrl, india.applyReceipt.url)
  assert.equal(job.country, 'India')
  assert.deepEqual(job.sourceNativeDates, { sitemapLastmod: india.entry.lastmod, nlxDateAdded: india.nlx.date_added,
    nlxDateNew: india.nlx.date_new, nlxDateUpdated: india.nlx.date_updated, workdayStartDate: '2026-09-30', workdayEndDate: null })
  assert.equal(job.sourceNativeStatusEvidence.nlxIsPosted, false)
  assert.equal(job.sourceNativeStatusEvidence.workdayPosted, true)
  assert.equal(job.sourceNativeStatusEvidence.workdayCanApply, true)
  assert.equal(job.sourceNativeEmployerEvidence.primaryLegalEmployer, '45101 Web Werks India Pvt Ltd')
  assert.equal(job.sourceNativeEmployerEvidence.nlxCompany, 'Iron Mountain')
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Iron catalog metadata never promotes observed sitemap routes to whole-company counts', () => {
  const provider = getScraperCatalog().find(item => item.source === 'ironmountainindia')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.verifiedPublicPostingCount, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
})

test('actual Romanian-primary Iron role remains eligible for its explicit native Chennai India office with its September10 date', async () => {
  const jobs = await execute([multi])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Chennai')
  assert.equal(jobs[0].sourceNativePrimaryCountry, 'Romania')
  assert.equal(jobs[0].sourceNativeEmployerEvidence.primaryLegalEmployer, '68300 Iron Mountain SRL')
  assert.equal(jobs[0].postingDate, '2026-09-10')
  const age = analyzePublishableJobs(jobs, { now: new Date(clock()) })
  assert.equal(age.eligibleJobs.length, 0)
  assert.equal(age.filterCounts.old, 1)
})

test('Iron rejects substituted employer, role, country, office, date, site and closed primary payloads', () => {
  for (const change of [
    x => { x.nlx.guid = 'A'.repeat(32) }, x => { x.nlx.company = 'Other Employer' },
    x => { x.nlx.city_slug = 'dallas' }, x => { x.nlx.country = 'United States' },
    x => { x.cxs.jobPostingInfo.jobReqId = 'J1' }, x => { x.cxs.jobPostingInfo.title = 'Other role' },
    x => { x.cxs.jobPostingInfo.jobPostingSiteId = 'OtherSite' }, x => { x.cxs.jobPostingInfo.posted = false },
    x => { x.cxs.jobPostingInfo.canApply = false }, x => { x.cxs.jobPostingInfo.externalUrl = 'https://unrelated.example/role' },
    x => { x.cxs.hiringOrganization.name = 'Unrelated employer' },
    x => { x.cxs.jobPostingInfo.country.descriptor = 'United States' },
    x => { x.cxs.jobPostingInfo.location = 'USA | Navi Mumbai | Other office' },
    x => { x.cxs.jobPostingInfo.location = 'IND | Chennai | Other office' },
    x => { x.cxs.jobPostingInfo.startDate = '2026-09-31' },
    x => { x.cxs.jobPostingInfo.startDate = '2026-10-01' },
    x => { x.nlx.date_added = '2026-10-01T07:54:42.714Z' },
    x => { x.nlx.date_added = 'not-a-publication-date' },
    x => { x.nlx.date_added = '2026-13-01T07:54:42.714Z' },
    x => { x.cxs.jobPostingInfo.jobDescription = '<template>Develop systems for customers.</template>' },
    x => { x.applyReceipt.url = x.applyReceipt.url.replace('ironmountain.wd5', 'other.wd5') },
    x => { x.applyReceipt.status = 403 },
  ]) {
    const sample = structuredClone(india); change(sample)
    assert.throws(() => source.extractNativeIronJob(sample.entry, sample.nlx, sample.applyReceipt, sample.cxs), /Iron Mountain/)
  }
  const noIndia = structuredClone(multi)
  noIndia.cxs.jobPostingInfo.additionalLocations[0] = 'USA | Chennai | Other office'
  assert.throws(() => source.extractNativeIronJob(noIndia.entry, noIndia.nlx, noIndia.applyReceipt, noIndia.cxs), /Iron Mountain/)
})

test('Iron preserves optional native closing dates and precision so closed roles cannot remain eligible', async () => {
  for (const [endDate, exact, precision] of [['2026-10-01', false, 'calendar-date'], ['2026-10-01T12:30:00+05:30', true, 'timestamp']]) {
    const sample = structuredClone(india)
    sample.cxs.jobPostingInfo.endDate = endDate
    const jobs = await execute([sample])
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].closingDate, endDate)
    assert.equal(jobs[0].sourceClosingDateIsExact, exact)
    assert.equal(jobs[0].sourceNativeDates.workdayEndDate, endDate)
    assert.equal(jobs[0].sourceNativeDatePrecision.workdayEndDate, precision)
    assert.equal(analyzePublishableJobs(jobs, { now: new Date(clock()) }).filterCounts.closed, 1)
  }
  for (const endDate of ['', '2026-09-31', '2026-10-01T12:00:00', 1791879132573]) {
    const sample = structuredClone(india)
    sample.cxs.jobPostingInfo.endDate = endDate
    assert.equal((await execute([sample])).length, 0)
  }
})

test('Iron rejects coherent future native publication clocks against the source run clock', async () => {
  for (const publication of ['2026-10-25T00:00:00.000Z', '2026-10-24T18:32:19.001Z']) {
    const sample = structuredClone(india)
    sample.nlx.date_added = publication
    sample.cxs.jobPostingInfo.startDate = publication.slice(0, 10)
    assert.throws(() => source.extractNativeIronJob(sample.entry, sample.nlx, sample.applyReceipt, sample.cxs,
      { now: clock() }), /future|publication.*clock/i)
    const jobs = await execute([sample])
    assert.equal(jobs.length, 0, 'Runtime extraction must pass its own clock to the native detail validator')
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.match(readInventoryEvidence(jobs).reason, /future|publication.*clock/i)
  }
})

test('Iron publication exactly at its run clock remains valid and native clocks remain immutable', () => {
  const sample = structuredClone(india)
  sample.nlx.date_added = clock()
  sample.cxs.jobPostingInfo.startDate = clock().slice(0, 10)
  const before = structuredClone(sample)
  const job = source.extractNativeIronJob(sample.entry, sample.nlx, sample.applyReceipt, sample.cxs, { now: clock() })
  assert.equal(job.postingDate, '2026-10-24')
  assert.equal(job.sourceNativeDates.nlxDateAdded, clock())
  assert.deepEqual(sample, before)
  assert.throws(() => source.extractNativeIronJob(sample.entry, sample.nlx, sample.applyReceipt, sample.cxs,
    { now: 'not-a-clock' }), /clock/i)
})

test('Iron default HTTP transport cannot supply a missing final response URL from the request', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ status: 429, headers: { get: () => null }, text: async () => '<title>Vercel Security Checkpoint</title><h1>Vercel Security Checkpoint</h1>' })
  try { await assert.rejects(source.run({ requestIntervalMs: 0 }), /Iron Mountain.*response identity/) }
  finally { globalThis.fetch = original }
})

test('authoritative CXS permission denial is never retried or filled from the NLX listing', async () => {
  const requested = []
  const jobs = await execute([india, denied], { fetchPage: async url => {
    requested.push(url)
    return route([india, denied], url)
  } })
  assert.deepEqual(jobs.map(job => job.jobId), [india.guid])
  assert.equal(requested.filter(url => url === denied.cxsUrl).length, 1)
  assert.match(readInventoryEvidence(jobs).reason, /403/)
  assert.match(readInventoryEvidence(jobs).reason, /S22/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Iron native request caps and cancellation retain a bounded lifecycle without fabricating response receipts', async () => {
  const requested = []
  const jobs = await execute([india, multi], { maxJobs: 1, fetchPage: async url => {
    requested.push(url); return route([india, multi], url)
  } })
  assert.equal(jobs.length, 1)
  assert.equal(requested.includes(multi.nativeDataUrl), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  await assert.rejects(source.run({ fetchText: async () => shell }), /Iron Mountain.*response receipts/)
  const controller = new AbortController(), reason = Error('stop native Iron')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(source.run({ signal: controller.signal, fetchPage: async () => { calls++; return {} } }), error => error === reason)
  assert.equal(calls, 0)
})

test('Iron source deadline cannot hang forever on an uncooperative request', async () => {
  let timer
  const result = await Promise.race([
    source.run({ sourceBudgetMs: 10, requestIntervalMs: 0, fetchPage: async () => new Promise(() => {}) })
      .then(() => ({ success: true }), error => ({ error })),
    new Promise(resolve => { timer = setTimeout(() => resolve({ timedOut: true }), 500) }),
  ])
  clearTimeout(timer)
  assert.equal(result.timedOut, undefined)
  assert.match(result.error?.message || '', /Iron Mountain.*source deadline/)
})

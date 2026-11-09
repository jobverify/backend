import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadAvantorModule = () => import('../../scraper/avantor/script.js')
const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'avantor')
const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const searchForPage = (page) => JSON.parse(readFixture('paradox-india-page-' + page + '.json'))
const allListings = [1, 2, 3].flatMap((page) => searchForPage(page).jobs)
const renderSearch = (search) => '<title>Search Jobs at Avantor</title><script>window.__PRELOAD_STATE__ = '
  + JSON.stringify({ jobSearch: search }) + '; window.__BUILD__ = "test";</script>'

const fixtureFetcher = ({ mutateSearch = () => {}, mutatePosting = (posting) => posting, failDetails = false } = {}) => async (url) => {
  if (url.includes('/global/en/search-results')) {
    throw Object.assign(new Error('HTTP 404 for ' + url), { status: 404, abortRetries: true })
  }
  const page = Number(url.match(/\/jobs\/page\/(\d+)/)?.[1])
  if (page) {
    assert.equal(new URL(url).searchParams.get('filter[country][0]'), 'India')
    const search = searchForPage(page)
    mutateSearch(page, search)
    return renderSearch(search)
  }
  if (failDetails) throw Object.assign(new Error('HTTP 404 for ' + url), { status: 404 })
  const id = url.match(/\/job\/(R-\d+)$/)?.[1]
  const listing = allListings.find((job) => job.requisitionID === id)
  if (!listing) throw new Error('Unexpected fixture URL: ' + url)
  const posting = mutatePosting({
    '@type': 'JobPosting', title: listing.title, url,
    identifier: { value: id }, hiringOrganization: { name: 'Avantor' },
    description: 'Maintain ERP and CRM systems with 5+ years experience.',
    employmentType: ['FULL_TIME'], datePosted: '2026-10-08',
    jobLocation: [{ address: { addressCountry: 'IN' } }],
  })
  return [].concat(posting).map((item) => '<script type="application/ld+json">' + JSON.stringify(item) + '</script>').join('')
}

test('Avantor uses the current Paradox route and completes the India inventory after the retired Phenom route returns 404', async () => {
  const { run } = await loadAvantorModule()
  const jobs = await run({ fetchText: fixtureFetcher() })
  assert.equal(jobs.length, 26)
  assert.equal(new Set(jobs.map((job) => job.jobId)).size, 26)
  assert.equal(jobs[0].jobId, 'R-174861')
  assert.equal(jobs[25].jobId, 'R-174270')
  assert.equal(jobs[0].company, 'Avantor')
  assert.equal(jobs[0].source, 'avantor')
  assert.ok(jobs.every((job) => job.country === 'India'))
  assert.equal(jobs[0].sourceUrl, 'https://careers.avantorsciences.com/amea-c4c-system-administration/job/R-174861')
  assert.equal(jobs[0].applyUrl, 'https://olivia.paradox.ai/co/Avantor1/Job?job_id=R-174861_1')
  assert.equal(jobs[0].jobDescription, 'Maintain ERP and CRM systems with 5+ years experience.')
  assert.equal(jobs[0].experienceRequired, '5+ years')
  assert.equal(jobs[0].employmentType, 'Full-time')
})

test('Avantor accepts a verified empty current India inventory', async () => {
  const { run } = await loadAvantorModule()
  assert.deepEqual(await run({ fetchText: fixtureFetcher({ mutateSearch: (_page, search) => {
    search.totalJob = 0
    search.jobs = []
  } }) }), [])
})

for (const [name, mutateSearch, expectedError] of [
  ['country filter disappears', (_page, search) => { search.params.filter = {} }, /filter or page contract/i],
  ['page identity repeats', (page, search) => { if (page === 2) search.params.page_number = 1 }, /filter or page contract/i],
  ['inventory total changes', (page, search) => { if (page === 2) search.totalJob = 27 }, /incomplete or changed/i],
  ['second page is empty', (page, search) => { if (page === 2) search.jobs = [] }, /incomplete or changed/i],
  ['requisition repeats', (page, search) => { if (page === 2) search.jobs[0] = searchForPage(1).jobs[0] }, /duplicate requisitions/i],
  ['job has no India location', (_page, search) => { search.jobs[0].locations.forEach((location) => { location.country = 'United States' }) }, /listing identity, location/i],
  ['apply URL points to another company', (_page, search) => { search.jobs[0].applyURL = 'https://olivia.paradox.ai/co/Other/Job?job_id=R-174861_1' }, /application URL changed/i],
]) {
  test('Avantor rejects incomplete or drifted inventory when ' + name, async () => {
    const { run } = await loadAvantorModule()
    await assert.rejects(run({ fetchText: fixtureFetcher({ mutateSearch }) }), expectedError)
  })
}

test('Avantor rejects an unrecognized page instead of treating it as empty', async () => {
  const { run } = await loadAvantorModule()
  await assert.rejects(run({ fetchText: async () => '<title>Maintenance</title>' }), /inventory is missing/i)
})

for (const [name, mutatePosting] of [
  ['requisition identity changes', (posting) => ({ ...posting, identifier: { value: 'R-999999' } })],
  ['description disappears', (posting) => ({ ...posting, description: '' })],
  ['employer changes', (posting) => ({ ...posting, hiringOrganization: { name: 'Other' } })],
  ['detail contains a conflicting job posting', (posting) => [{ ...posting, title: 'Other job', identifier: { value: 'R-999999' } }, posting]],
]) {
  test('Avantor rejects a current job detail when ' + name, async () => {
    const { run } = await loadAvantorModule()
    await assert.rejects(run({ fetchText: fixtureFetcher({ mutatePosting }) }), /job detail identity|job description/i)
  })
}

for (const options of [{ maxPages: 1 }, { maxJobs: 25 }]) {
  test('Avantor rejects caller limits that would truncate the published inventory: ' + JSON.stringify(options), async () => {
    const { run } = await loadAvantorModule()
    await assert.rejects(run({ ...options, fetchText: fixtureFetcher() }), /incomplete/i)
  })
}

test('Avantor preserves upstream detail failure instead of returning partial jobs', async () => {
  const { run } = await loadAvantorModule()
  await assert.rejects(run({ fetchText: fixtureFetcher({ failDetails: true }) }), (error) => error.status === 404)
})

test('Avantor honors cancellation before fetching inventory', async () => {
  const { run } = await loadAvantorModule()
  const controller = new AbortController()
  const reason = new DOMException('Cancelled by caller', 'AbortError')
  controller.abort(reason)
  await assert.rejects(run({ signal: controller.signal, fetchText: async () => assert.fail('Unexpected fetch after cancellation') }), (error) => error === reason)
})

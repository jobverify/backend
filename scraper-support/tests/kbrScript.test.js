import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createKbrScraper, run } from '../../scraper/kbr/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'kbr')
const readFixture = name => readFileSync(path.join(fixturesDir, name), 'utf8')
const fixtureJson = name => JSON.parse(readFixture(name))
const snapshot = fixtureJson('current-snapshot.json')
const detail = fixtureJson('current-workday-detail.json')
const now = () => '2026-10-08T18:00:00.000Z'
const buildFetch = ({ snapshotValue = snapshot, widget = { name: 'KBR', jobs: [] }, detailValue = detail, search = { total: 0, jobPostings: [] }, control = { total: 1, jobPostings: [{ bulletFields: ['R2109999'] }] }, overview = readFixture('migration-overview.html') } = {}, requests = []) => ({
  fetchText: async url => {
    requests.push(url)
    if (url === 'https://www.kbr.com/en') return readFixture('homepage.html')
    if (url === 'https://careers.kbr.com/us/en') return overview
    if (url === 'https://jobs.kbr.com/jobs.html') return readFixture('current-jobs.html')
    if (url === 'https://jobs.kbr.com/data/kbr-jobs.json') return JSON.stringify(snapshotValue)
    if (url === 'https://apply.workable.com/api/v1/widget/accounts/kbr') return JSON.stringify(widget)
    if (url === 'https://kbr.wd5.myworkdayjobs.com/wday/cxs/kbr/KBR_Careers/job/Chennai-Tamil-Nadu-India/Designer_R2109999') return JSON.stringify(detailValue)
    throw new Error('Unexpected KBR fixture URL: ' + url)
  },
  fetchJson: async (url, options) => {
    requests.push(url)
    assert.equal(url, 'https://kbr.wd5.myworkdayjobs.com/wday/cxs/kbr/KBR_Careers/jobs')
    assert.equal(options.method, 'POST')
    const requisition = JSON.parse(options.body).searchText
    if (requisition === 'R2109999') return control
    assert.equal(requisition, 'R2121383')
    return search
  },
})

test('KBR follows its current first-party migration and preserves the complete snapshot with actionable India details', async () => {
  const requests = []
  const jobs = await createKbrScraper({ now }).run(buildFetch({}, requests))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'KBR')
  assert.equal(jobs[0].source, 'kbr')
  assert.equal(jobs[0].jobId, 'R2109999')
  assert.equal(jobs[0].location, 'Chennai, Tamil Nadu, India')
  assert.equal(jobs[0].city, 'Chennai')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, '2026-10-01')
  assert.equal(jobs[0].applyUrl, 'https://kbr.wd5.myworkdayjobs.com/KBR_Careers/job/Chennai-Tamil-Nadu-India/Designer_R2109999')
  assert.match(jobs[0].jobDescription, /detail design deliverables/i)
  assert.equal(requests.some(url => /search-results|Trinzic/.test(url)), false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 1)
  assert.match(evidence.reason, /3-snapshot-rows-2-india-1-unpublished/)
})

for (const { name, options, error } of [
  { name: 'a missing advertised snapshot total', options: { snapshotValue: { ...snapshot, total_jobs: undefined } }, error: /incomplete KBR snapshot/ },
  { name: 'a truncated snapshot', options: { snapshotValue: { ...snapshot, total_jobs: 4 } }, error: /incomplete KBR snapshot/ },
  { name: 'duplicate snapshot requisitions', options: { snapshotValue: { ...snapshot, jobs: [snapshot.jobs[0], snapshot.jobs[0], snapshot.jobs[2]] } }, error: /snapshot requisition/ },
  { name: 'a stale snapshot', options: { snapshotValue: { ...snapshot, generated_at: '2026-10-01' } }, error: /snapshot freshness/ },
  { name: 'a foreign application tenant', options: { snapshotValue: { ...snapshot, jobs: snapshot.jobs.map(job => job.application_url ? { ...job, application_url: job.application_url.replace('kbr.wd5', 'other.wd5') } : job) } }, error: /verified KBR Workday tenant/ },
  { name: 'unexpected published Workable roles', options: { widget: { name: 'KBR', jobs: [{ shortcode: 'ABC', title: 'Engineer' }] } }, error: /Workable inventory.*reverified/ },
  { name: 'unresolved unlinked public requisitions', options: { search: { total: 1, jobPostings: [{ externalPath: '/job/Unexpected' }] } }, error: /unlinked India requisition/ },
  { name: 'mismatched detail requisitions', options: { detailValue: { ...detail, jobPostingInfo: { ...detail.jobPostingInfo, jobReqId: 'R9999999' } } }, error: /India job detail/ },
  { name: 'non-India live details', options: { detailValue: { ...detail, jobPostingInfo: { ...detail.jobPostingInfo, country: { descriptor: 'United Kingdom' } } } }, error: /India job detail/ },
  { name: 'unpublished live details', options: { detailValue: { ...detail, jobPostingInfo: { ...detail.jobPostingInfo, canApply: false } } }, error: /India job detail/ },
  { name: 'missing live descriptions', options: { detailValue: { ...detail, jobPostingInfo: { ...detail.jobPostingInfo, jobDescription: '' } } }, error: /India job description/ },
]) {
  test('KBR rejects ' + name + ' without masking incomplete inventory', async () => {
    await assert.rejects(createKbrScraper({ now }).run(buildFetch(options)), error)
  })
}

test('KBR rejects an overview whose KBR handoff goes to the separate Trinzic board', async () => {
  await assert.rejects(run(buildFetch({ overview: readFixture('migration-overview.html').replace('https://jobs.kbr.com', 'https://careers.trinzic.com') })), /verified KBR careers migration/)
})

test('KBR validates an empty snapshot and additional live widget before returning verified empty', async () => {
  const jobs = await createKbrScraper({ now }).run(buildFetch({ snapshotValue: { ...snapshot, total_jobs: 0, jobs: [] } }))
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('KBR resolves new ISO country codes absent from the website map using the matching public Workday country', async () => {
  const fetchers = buildFetch({ snapshotValue: { ...snapshot, jobs: snapshot.jobs.map(job => job.id === 'R2111111' ? { ...job, location: 'MEX, Altamira, Engineering Centre' } : job) } })
  const baseFetch = fetchers.fetchText
  fetchers.fetchText = async url => url === 'https://kbr.wd5.myworkdayjobs.com/wday/cxs/kbr/KBR_Careers/job/London-United-Kingdom/Engineer_R2111111'
    ? JSON.stringify({ jobPostingInfo: { jobReqId: 'R2111111', country: { descriptor: 'Mexico' }, canApply: true, posted: true } }) : baseFetch(url)
  const jobs = await createKbrScraper({ now }).run(fetchers)
  assert.deepEqual(jobs.map(job => job.jobId), ['R2109999'])
})

test('KBR requires a matching published requisition search control before interpreting unlinked zero results', async () => {
  await assert.rejects(createKbrScraper({ now }).run(buildFetch({ control: { total: 0, jobPostings: [] } })), /public requisition search control/)
})

test('KBR resolves a snapshot location without a country code from its exact active Workday requisition', async () => {
  const fetchers = buildFetch({ snapshotValue: {
    ...snapshot,
    jobs: snapshot.jobs.map(job => job.id === 'R2111111'
      ? { ...job, location: 'Huntsville Alabama - 6200 Redstone Gateway SW' } : job),
  } })
  const baseFetch = fetchers.fetchText
  fetchers.fetchText = async url => url === 'https://kbr.wd5.myworkdayjobs.com/wday/cxs/kbr/KBR_Careers/job/London-United-Kingdom/Engineer_R2111111'
    ? JSON.stringify({ jobPostingInfo: { jobReqId: 'R2111111', country: { descriptor: 'United States of America' }, canApply: true, posted: true } }) : baseFetch(url)
  const jobs = await createKbrScraper({ now }).run(fetchers)
  assert.deepEqual(jobs.map(job => job.jobId), ['R2109999'])
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('KBR retains India roles whose snapshot locations omit the country code', async () => {
  const fetchers = buildFetch({ snapshotValue: {
    ...snapshot, jobs: snapshot.jobs.map(job => job.id === 'R2109999' ? { ...job, location: 'Chennai Engineering Centre' } : job),
  } })
  const jobs = await createKbrScraper({ now }).run(fetchers)
  assert.deepEqual(jobs.map(job => [job.jobId, job.country]), [['R2109999', 'India']])
})

for (const info of [
  { jobReqId: 'R9999999', country: { descriptor: 'United States of America' }, canApply: true, posted: true },
  { jobReqId: 'R2111111', country: { descriptor: 'United States of America' }, canApply: false, posted: true },
  { jobReqId: 'R2111111', country: {}, canApply: true, posted: true },
]) {
  test('KBR rejects an unverifiable Workday country for a location without an ISO code: ' + JSON.stringify(info), async () => {
    const fetchers = buildFetch({ snapshotValue: {
      ...snapshot, jobs: snapshot.jobs.map(job => job.id === 'R2111111' ? { ...job, location: 'Huntsville Alabama' } : job),
    } })
    const baseFetch = fetchers.fetchText
    fetchers.fetchText = async url => url.endsWith('/Engineer_R2111111') ? JSON.stringify({ jobPostingInfo: info }) : baseFetch(url)
    await assert.rejects(createKbrScraper({ now }).run(fetchers), /unresolved snapshot country/)
  })
}

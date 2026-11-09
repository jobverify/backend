import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { run, CAREERS_URL, JOBS_API_URL } from '../../scraper/triconinfotech/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const ARCHIVE_URL = 'https://www.triconinfotech.com/jobs/'
const fixture = name => fs.readFile(new URL('./fixtures/triconinfotech/' + name, import.meta.url), 'utf8')
const [careers, archive, detail, inventory] = await Promise.all(['careers.html', 'archive.html', 'detail.html', 'inventory.json'].map(fixture))
const items = JSON.parse(inventory)
const mock = () => ({
  fetchText: async url => {
    if (url === CAREERS_URL) return careers
    if (url === ARCHIVE_URL) return archive
    if (url === items[0].link) return detail
    throw new Error('Unexpected HTML request: ' + url)
  },
  fetchJson: async () => structuredClone(items),
  fetchFeed: async url => {
    assert.equal(url, JOBS_API_URL)
    return { items: structuredClone(items), total: 1, totalPages: 1 }
  },
})

test('current published Portland role is fully checked and yields evidenced India-zero', async () => {
  let detailCalls = 0
  const options = mock(), fetchText = options.fetchText
  options.fetchText = async url => { if (url === items[0].link) detailCalls++; return fetchText(url) }
  const jobs = await run(options)
  assert.equal(jobs.length, 0)
  assert.equal(detailCalls, 1)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.listingComplete, true)
})

const relocated = (location, id = items[0].id) => {
  const row = structuredClone(items[0])
  row.id = id
  row.title.rendered = row.title.rendered.replace('Portland', location)
  row.link = id === items[0].id ? row.link : 'https://www.triconinfotech.com/jobs/role-' + id + '/'
  row.class_list = row.class_list.map(value => value === 'post-' + items[0].id ? 'post-' + id
    : value === 'job-location-portland' ? 'job-location-' + location.toLowerCase().replace(/\s+/g, '-') : value)
  return row
}
const htmlFor = row => detail.replaceAll(String(items[0].id), String(row.id))
  .replaceAll('Portland', row.title.rendered.split('&#8211; ')[1])
const optionsFor = rows => ({
  fetchText: async url => url === CAREERS_URL ? careers : url === ARCHIVE_URL ? archive
    : htmlFor(rows.find(row => row.link === url) || (() => { throw new Error('Unexpected detail URL') })()),
  fetchFeed: async () => ({ items: structuredClone(rows), total: rows.length, totalPages: 1 }),
})

test('published Bengaluru role maps full description and current native application URL', async () => {
  const row = relocated('Bengaluru'), [job] = await run(optionsFor([row]))
  assert.equal(job.title, 'DevOps Engineer (Azure DevOps) – Bengaluru')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bangalore')
  assert.equal(job.jobId, '312962')
  assert.equal(job.applyUrl, row.link)
  assert.equal(job.sourceUrl, row.link)
  assert.equal(job.postingDate, '2026-10-05T11:53:27.000Z')
  assert.equal(job.experienceRequired, '3+ years')
  assert.ok(job.jobDescription.includes('Typical Deliverables'))
  assert.ok(job.jobDescription.endsWith('DevOps process improvement initiatives'))
  assert.equal(job.employmentType, 'FULL_TIME')
})

test('all WordPress pages and all 101 details reconcile before filtering one India role', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => relocated(i === 100 ? 'Bengaluru' : 'Portland', items[0].id + i))
  const options = optionsFor(rows), pages = [], details = []
  const fetchText = options.fetchText
  options.fetchText = async url => { if (url !== CAREERS_URL && url !== ARCHIVE_URL) details.push(url); return fetchText(url) }
  options.fetchFeed = async url => {
    const page = Number(new URL(url).searchParams.get('page'))
    pages.push(page)
    return { items: structuredClone(rows.slice((page - 1) * 100, page * 100)), total: 101, totalPages: 2 }
  }
  const jobs = await run(options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, String(items[0].id + 100))
  assert.equal(details.length, 101)
  assert.deepEqual(pages, [1, 2, 1, 2])
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 101)
})

test('truncated feed, missing total headers, and repeated identities fail closed', async () => {
  for (const payload of [
    { items, total: 2, totalPages: 1 },
    { items, totalPages: 1 },
    { items: [items[0], items[0]], total: 2, totalPages: 1 },
    { items: { error: 'not-array' }, total: 1, totalPages: 1 },
  ]) {
    const options = mock()
    options.fetchFeed = async () => structuredClone(payload)
    await assert.rejects(run(options), /pagination|truncated|repeated/)
  }
})

test('publication and full-content fields must be present before country filtering', async () => {
  for (const change of [
    { status: 'draft' }, { type: 'post' }, { content: { rendered: '', protected: false } },
    { content: { rendered: items[0].content.rendered, protected: true } },
    { date_gmt: 'invalid' },
  ]) {
    const options = mock()
    options.fetchFeed = async () => ({ items: [{ ...structuredClone(items[0]), ...change }], total: 1, totalPages: 1 })
    await assert.rejects(run(options), /malformed job row/)
  }
})

test('detail description, organization, title, date, and form ID must agree even for foreign roles', async () => {
  for (const html of [
    detail.replace('DevOps process improvement initiatives', 'Truncated description'),
    detail.replace('"name":"Tricon Infotech"', '"name":"Other Employer"'),
    detail.replace('<h1>DevOps Engineer', '<h1>Wrong title'),
    detail.replace('"datePosted":"2026-10-05', '"datePosted":"2026-10-04'),
    detail.replace('name="awsm_job_id" value="312962"', 'name="awsm_job_id" value="99"'),
    detail.replace('id="awsm-application-form"', 'id="missing-form"'),
  ]) {
    const options = mock(), fetchText = options.fetchText
    options.fetchText = async url => url === items[0].link ? html : fetchText(url)
    await assert.rejects(run(options), /detail or application identity/)
  }
})

test('unknown job-specific country fails instead of becoming a false India-zero', async () => {
  await assert.rejects(run(optionsFor([relocated('Unresolved Office')])), /unresolved public job location country/)
})

test('conflicting taxonomy location fails closed', async () => {
  const options = mock(), fetchText = options.fetchText
  options.fetchText = async url => url === items[0].link ? detail.replace('"address":"Portland"', '"address":"Bengaluru"') : fetchText(url)
  await assert.rejects(run(options), /location taxonomy/)
})

test('archive roles missing from REST inventory fail closed', async () => {
  const options = mock(), fetchText = options.fetchText
  options.fetchText = async url => url === ARCHIVE_URL
    ? archive + '<a href="https://www.triconinfotech.com/jobs/unlisted/">Unlisted role</a>' : fetchText(url)
  await assert.rejects(run(options), /archive and REST inventory disagree/)
})

test('changing published snapshot cannot be accepted after detail validation', async () => {
  const options = mock()
  let calls = 0
  options.fetchFeed = async () => ({ items: [{ ...structuredClone(items[0]), modified_gmt: ++calls === 1 ? '2026-10-06T07:34:32' : '2026-10-07T07:34:32' }], total: 1, totalPages: 1 })
  await assert.rejects(run(options), /inventory changed/)
})

test('empty REST count still rejects a visible public role', async () => {
  const options = mock()
  options.fetchFeed = async () => ({ items: [], total: 0, totalPages: 0 })
  await assert.rejects(run(options), /archive and REST inventory disagree/)
})

test('reconciled zero global count receives verified-empty evidence', async () => {
  const options = mock(), fetchText = options.fetchText
  options.fetchText = async url => url === ARCHIVE_URL
    ? '<html><title>Job Openings Archive - Tricon Infotech</title><body class="awsm_job_openings"><script>var awsmJobsPublic={};</script></body></html>'
    : fetchText(url)
  options.fetchFeed = async () => ({ items: [], total: 0, totalPages: 0 })
  const jobs = await run(options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})

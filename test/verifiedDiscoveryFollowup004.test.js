import assert from 'node:assert/strict'
import test from 'node:test'
import * as avoma from '../scraper/avoma/script.js'
import * as avaloq from '../scraper/avaloq.workday/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const description = '<p>Build and maintain production services and improve platform reliability.</p>'
const office = { country: 'India', country_code: 'IN', city: 'Pune', location: 'Pune, Maharashtra, India' }
const kulaRow = (id = 3146) => ({ id, account_id: 1278, title: 'Software Engineer', listed: true,
  is_confidential: false, kind: 'external', launch_at: '2026-10-01T00:00:00.000Z', end_at: null,
  ats_job: { offices: [office], job_description: description, employment_type: 'full_time' } })
const flight = rows => `<script>self.__next_f.push(${JSON.stringify([1, `1:${JSON.stringify({ accountName: 'avoma', jobs: rows, departments: [], locations: [] })}\n`])})</script>`

test('Avoma preserves actual dates/content and reports only partial observed India inventory', async () => {
  const rows = [kulaRow(), { ...kulaRow(99), ats_job: { ...kulaRow().ats_job, offices: [{ country: 'United States', country_code: 'US', city: 'San Jose', location: 'San Jose, California, United States' }] } }]
  const jobs = await avoma.run({ fetchText: async url => { assert.equal(url, 'https://careers.kula.ai/avoma?jobs=true'); return flight(rows) } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, description)
  assert.equal(jobs[0].postingDate, rows[0].launch_at)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].applyUrl, 'https://careers.kula.ai/avoma/3146/?jobs=true')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

for (const [name, mutate] of [
  ['wrong account', row => { row.account_id = 1 }],
  ['nonpublic role', row => { row.listed = false }],
  ['unknown country', row => { row.ats_job.offices = [{ country: 'Unknown', country_code: 'ZZ', location: 'Remote' }] }],
  ['conflicting country', row => { row.ats_job.offices = [{ ...office, country_code: 'US' }] }],
  ['malformed country', row => { row.ats_job.offices = [{ ...office, country: ['India'] }] }],
  ['contradictory city', row => { row.ats_job.offices = [{ ...office, city: 'Seattle' }] }],
  ['invalid date', row => { row.launch_at = 'bad' }],
]) test(`Avoma rejects ${name} before selection`, async () => {
  const row = structuredClone(kulaRow()); mutate(row)
  await assert.rejects(() => avoma.run({ fetchText: async () => flight([row]) }))
})

test('Avoma missing content and empty observed model never authorize cleanup or zero', async () => {
  const row = kulaRow(); row.ats_job.job_description = ''
  const jobs = await avoma.run({ fetchText: async () => flight([row]) })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  const empty = await avoma.run({ fetchText: async () => flight([]) })
  assert.equal(readInventoryEvidence(empty).status, 'discovery-only')
  assert.equal(readInventoryEvidence(empty).listingComplete, false)
})

const listing = (id = '744000152645906') => ({ id, name: 'Software Test Specialist', company: { identifier: 'Avaloq1', name: 'Avaloq' },
  visibility: 'PUBLIC', location: { country: 'in', city: 'Pune', fullLocation: 'Pune, Maharashtra, India' },
  ref: `https://api.smartrecruiters.com/v1/companies/Avaloq1/postings/${id}`, releasedDate: '2026-10-01T00:00:00.000Z' })
const detail = row => ({ ...row, postingUrl: `https://jobs.smartrecruiters.com/Avaloq1/${row.id}-native-role`,
  applyUrl: `https://jobs.smartrecruiters.com/Avaloq1/${row.id}-native-role?oga=true`,
  jobAd: { sections: { jobDescription: { text: description } } } })
const fetcher = (rows, mutatePage, mutateDetail) => async url => {
  const u = new URL(url)
  if (u.pathname.endsWith('/postings')) {
    const offset = Number(u.searchParams.get('offset'))
    const value = { totalFound: rows.length, offset, limit: 100, content: rows.slice(offset, offset + 100) }
    mutatePage?.(value, offset); return value
  }
  const value = structuredClone(detail(rows.find(row => row.ref === url))); mutateDetail?.(value); return value
}

test('Avaloq reconciles every native page and preserves exact returned apply URLs/content', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => listing(String(744000152645900 + i)))
  const jobs = await avaloq.run({ fetchJson: fetcher(rows) })
  assert.equal(jobs.length, 101)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 101)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(jobs[0].applyUrl, detail(rows[0]).applyUrl)
  assert.match(jobs[0].jobDescription, /production services/)
})

for (const [name, page, change] of [
  ['changed total', (p, offset) => { if (offset) p.totalFound++ }],
  ['duplicate IDs', (p, offset) => { if (offset) p.content[0] = listing('744000152645900') }],
  ['premature empty page', (p, offset) => { if (offset) p.content = [] }],
  ['wrong native company', null, p => { p.company.identifier = 'Wrong' }],
  ['wrong native ID', null, p => { p.id = '1234' }],
  ['wrong title', null, p => { p.name = 'Unrelated role' }],
  ['wrong detail country', null, p => { p.location.country = 'us' }],
  ['wrong apply ID', null, p => { p.applyUrl = 'https://jobs.smartrecruiters.com/Avaloq1/1234-other' }],
  ['upstream error', null, p => { p.error = 'upstream' }],
  ['conflicting detail city label', null, p => { p.location.fullLocation = 'Puneville, Maharashtra, India' }],
]) test(`Avaloq rejects ${name}`, async () => {
  const rows = Array.from({ length: 101 }, (_, i) => listing(String(744000152645900 + i)))
  await assert.rejects(() => avaloq.run({ fetchJson: fetcher(rows, page, change) }))
})

test('Avaloq genuinely empty details retain listing rows but disable lifecycle completion', async () => {
  const jobs = await avaloq.run({ fetchJson: fetcher([listing()], null, p => { p.jobAd.sections.jobDescription.text = '' }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avaloq rejects malformed or duplicate native ID types before empty-content selection', async () => {
  const row = listing(); row.id = Number(row.id)
  await assert.rejects(() => avaloq.run({ fetchJson: fetcher([row], null, p => { p.jobAd.sections.jobDescription.text = '' }) }))
})

test('Avaloq only certifies zero with explicit native total and terminal empty page', async () => {
  const empty = await avaloq.run({ fetchJson: fetcher([]) })
  assert.equal(readInventoryEvidence(empty).status, 'verified-empty')
  assert.equal(readInventoryEvidence(empty).reportedTotal, 0)
  await assert.rejects(() => avaloq.run({ fetchJson: async () => ({ content: [], offset: 0, limit: 100 }) }))
})

test('Avaloq reconciles private records without fetching private details', async () => {
  const row = listing(); row.visibility = 'PRIVATE'
  const jobs = await avaloq.run({ fetchJson: async url => {
    assert.equal(new URL(url).pathname.endsWith('/postings'), true)
    return { totalFound: 1, offset: 0, limit: 100, content: [row] }
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('Avaloq honors caller abort before requesting inventory', async () => {
  const controller = new AbortController(); controller.abort()
  await assert.rejects(() => avaloq.run({ signal: controller.signal, fetchJson: async () => { assert.fail('unexpected request') } }))
})

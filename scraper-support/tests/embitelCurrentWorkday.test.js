import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { run, CAREERS_URL, OPENINGS_URL, JOBS_SCRIPT_URL, JOBS_API_URL } from '../../scraper/embiteltechnologies/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const read = name => fs.readFile(new URL('./fixtures/embiteltechnologies/' + name, import.meta.url), 'utf8')
const [careers, openings, client, ajaxText, listingText, detailText] = await Promise.all(['careers.html', 'openings.html', 'client.txt', 'ajax-handoff.json', 'workday-listing.json', 'workday-details.json'].map(read))
const ajax = JSON.parse(ajaxText), listing = JSON.parse(listingText), details = JSON.parse(detailText)
const CXS = 'https://diconium.wd3.myworkdayjobs.com/wday/cxs/diconium/Embitel_Technologies'
const options = () => ({
  fetchText: async url => {
    if (url === CAREERS_URL) return careers
    if (url === OPENINGS_URL) return openings
    if (url === JOBS_SCRIPT_URL) return client
    throw new Error('Unexpected public HTML request: ' + url)
  },
  fetchJson: async (url, init) => {
    if (url === JOBS_API_URL) { assert.equal(init.body, 'action=get_wdhub_job'); return structuredClone(ajax) }
    if (url === CXS + '/jobs') {
      assert.equal(init.method, 'POST')
      assert.deepEqual(JSON.parse(init.body), { appliedFacets: {}, limit: 20, offset: 0, searchText: '' })
      return structuredClone(listing)
    }
    const index = listing.jobPostings.findIndex(row => url === CXS + row.externalPath)
    if (index >= 0) return structuredClone(details[index])
    throw new Error('Unexpected public JSON request: ' + url)
  },
})
test('current native inventory replaces stale AJAX titles, includes missing native jobs, and validates employer/India/details', async () => {
  const jobs = await run(options())
  assert.deepEqual(jobs.map(job => job.requisitionId).sort(), ['JR101653', 'JR101673'])
  assert.deepEqual(jobs.map(job => job.title).sort(), ['Intern', 'Senior Python Developer'])
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription && job.applyUrl === job.sourceUrl))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 2)
})

test('all native pages and all details reconcile before India filtering', async () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    ...structuredClone(listing.jobPostings[0]), title: 'Engineer ' + index,
    externalPath: '/job/Bangalore/Engineer-' + index + '_JR' + (200000 + index),
    bulletFields: ['JR' + (200000 + index)],
  }))
  const mock = options(), offsets = [], detailsFetched = []
  mock.fetchJson = async (url, init) => {
    if (url === JOBS_API_URL) return structuredClone(ajax)
    if (url === CXS + '/jobs') {
      const offset = JSON.parse(init.body).offset
      offsets.push(offset)
      return { total: offset ? 0 : 21, jobPostings: rows.slice(offset, offset + 20) }
    }
    const row = rows.find(row => url === CXS + row.externalPath)
    detailsFetched.push(row.bulletFields[0])
    const value = structuredClone(details[0]), info = value.jobPostingInfo
    Object.assign(info, { title: row.title, jobReqId: row.bulletFields[0], jobPostingId: row.externalPath.split('/').pop(), externalUrl: 'https://diconium.wd3.myworkdayjobs.com/Embitel_Technologies' + row.externalPath })
    return value
  }
  const jobs = await run(mock)
  assert.equal(jobs.length, 21)
  assert.equal(detailsFetched.length, 21)
  assert.deepEqual(offsets, [0, 20, 0, 20])
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 21)
})
test('wrong legal employer, board, requisition, title and application state fail closed', async () => {
  for (const change of [
    value => { value.hiringOrganization.name = 'Unrelated diconium employer' },
    value => { value.jobPostingInfo.jobPostingSiteId = 'Other_Board' },
    value => { value.jobPostingInfo.jobReqId = 'JR99' },
    value => { value.jobPostingInfo.title = 'Changed title' },
    value => { value.jobPostingInfo.canApply = false },
    value => { value.jobPostingInfo.posted = false },
    value => { value.jobPostingInfo.externalUrl = 'https://example.com/wrong' },
    value => { value.jobPostingInfo.jobDescription = '' },
  ]) {
    const mock = options(), fetchJson = mock.fetchJson
    mock.fetchJson = async (url, init) => { const value = await fetchJson(url, init); if (url === CXS + listing.jobPostings[0].externalPath) change(value); return value }
    await assert.rejects(run(mock), /employer|application status/)
  }
})
test('known foreign country is excluded only after native employer and application checks', async () => {
  const mock = options(), fetchJson = mock.fetchJson
  mock.fetchJson = async (url, init) => {
    const value = await fetchJson(url, init)
    if (url === CXS + listing.jobPostings[0].externalPath) {
      value.jobPostingInfo.country = { descriptor: 'Germany', id: 'germany-id' }
      value.jobPostingInfo.jobRequisitionLocation.country = { descriptor: 'Germany', id: 'germany-id', alpha2Code: 'DE' }
    }
    return value
  }
  const jobs = await run(mock)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].requisitionId, 'JR101653')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
})
test('unknown and contradictory native countries never create a false India-zero', async () => {
  for (const code of ['', 'US', 'ZZ']) {
    const mock = options(), fetchJson = mock.fetchJson
    mock.fetchJson = async (url, init) => { const value = await fetchJson(url, init); if (value.jobPostingInfo) value.jobPostingInfo.jobRequisitionLocation.country.alpha2Code = code; return value }
    await assert.rejects(run(mock), /location country/)
  }
})
test('native total, duplicate identity, and a truncated page reject incomplete inventory', async () => {
  for (const value of [
    { total: 3, jobPostings: listing.jobPostings },
    { total: 2, jobPostings: [listing.jobPostings[0], listing.jobPostings[0]] },
    { jobPostings: [] },
  ]) {
    const mock = options(), fetchJson = mock.fetchJson
    mock.fetchJson = async (url, init) => url === CXS + '/jobs' ? structuredClone(value) : fetchJson(url, init)
    await assert.rejects(run(mock), /total|count|pagination|duplicate/)
  }
})
test('changed second native snapshot rejects concurrent inventory drift', async () => {
  const mock = options(), fetchJson = mock.fetchJson
  let calls = 0
  mock.fetchJson = async (url, init) => { const value = await fetchJson(url, init); if (url === CXS + '/jobs' && ++calls > 1) value.jobPostings[0].title = 'Changed'; return value }
  await assert.rejects(run(mock), /inventory changed/)
})
test('an explicit cap retains truthful coverage-gap evidence after complete verification', async () => {
  const jobs = await run({ ...options(), maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, 2)
})
test('missing current first-party employer pointer and unrelated handoffs reject', async () => {
  for (const data of [[], [{ job_url: 'https://diconium.wd3.myworkdayjobs.com/Other_Board/job/Bangalore/Wrong_JR1' }]]) {
    const mock = options(), fetchJson = mock.fetchJson
    mock.fetchJson = async (url, init) => url === JOBS_API_URL ? { success: true, data } : fetchJson(url, init)
    await assert.rejects(run(mock), /handoff/)
  }
})
test('verified employer native zero has explicit authoritative inventory evidence', async () => {
  const mock = options(), fetchJson = mock.fetchJson
  mock.fetchJson = async (url, init) => url === CXS + '/jobs' ? { total: 0, jobPostings: [] } : fetchJson(url, init)
  const jobs = await run(mock)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { API_URL, CAREERS_URL, createClassplusScraper, extractJobs } from '../../scraper/classplus/script.js'

test('Classplus listing extraction preserves native discovery fields without inventing job fields', () => {
  const row = { jobId: 'cp-123', title: 'Senior Backend Engineer', department: 'VIDU', parentDepartment: 'Engineering Team',
    locationCity: 'Abu Dhabi', employeeType: 'Full Time', country: 'United Arab Emirates' }
  assert.deepEqual(extractJobs({ data: { Jobs: [row] }, message: 'Jobs Fetched Successfully' }), [row])
  assert.equal(Object.hasOwn(row, 'requisitionId'), false)
  assert.equal(Object.hasOwn(row, 'remoteStatus'), false)
  assert.deepEqual(extractJobs({ data: { Jobs: [] }, message: 'Jobs Fetched Successfully' }), [])
  assert.throws(() => extractJobs({ data: { Jobs: [] }, error: 'unavailable' }))
  assert.throws(() => extractJobs({ data: { Jobs: [row, row] }, message: 'Jobs Fetched Successfully' }))
})

test('Classplus list-only injection cannot skip the current client contract or publish fabricated jobs', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Live network forbidden') })
  const requests = []
  await assert.rejects(createClassplusScraper().run({
    fetchJson: async () => { throw Error('Unverified list transport must not run') },
    fetchPage: async url => { requests.push(url); return { status: 200, url, body: '<title>Classplus careers</title><div id="root"></div>' } },
  }), /contract/)
  assert.deepEqual(requests, [CAREERS_URL])
  assert.ok(!requests.includes(API_URL))
})

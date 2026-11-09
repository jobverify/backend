import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

const provider = () => getScraperCatalog().find((item) => item.source === 'postman')
const cacheUrl = 'https://www.postman.com/_mk-www-next/api-cache/careers-jobs.json'
const indiaUrl = 'https://postman.wd108.myworkdayjobs.com/careers/job/Bangalore-India/Senior-Engineer---AI_JR1000054'
const usUrl = 'https://postman.wd108.myworkdayjobs.com/careers/job/Boston-MA-US/Account-Representative_JR1000008'
const payload = {
  jobs: [
    {
      id: 'JR1000054',
      title: 'Senior Engineer - AI',
      url: indiaUrl,
      location: 'Bangalore, India',
      department: 'Engineering',
      updated_at: '2026-09-25T21:18:18.856Z',
      description: 'Build AI tools for Postman.',
    },
    {
      id: 'JR1000008',
      title: 'Account Representative',
      url: usUrl,
      location: 'Boston, MA, US',
      department: 'Sales',
      updated_at: '2026-09-17T21:18:18.856Z',
      description: 'Work with customers.',
    },
  ],
  meta: { total: 2, source: 'workday_cxs', careersUrl: 'https://postman.wd108.myworkdayjobs.com/careers' },
}

test('Postman maps its first party Workday cache and keeps India jobs', async () => {
  const postman = provider()
  assert.ok(postman)
  assert.equal(postman.atsPlatform, 'workday')
  assert.equal(postman.config.discovery.listingApiUrl, cacheUrl)
  const jobs = await runApiPortalScraper({
    provider: postman,
    fetchJson: async (url, options) => {
      assert.equal(url, cacheUrl)
      assert.equal(options.method, 'GET')
      return payload
    },
  })
  assert.equal(jobs.length, 1)
  assert.deepEqual({
    title: jobs[0].title,
    location: jobs[0].location,
    country: jobs[0].country,
    sourceUrl: jobs[0].sourceUrl,
    applyUrl: jobs[0].applyUrl,
    jobId: jobs[0].jobId,
    requisitionId: jobs[0].requisitionId,
    department: jobs[0].department,
    postingDate: jobs[0].postingDate,
    jobDescription: jobs[0].jobDescription,
  }, {
    title: 'Senior Engineer - AI',
    location: 'Bangalore, India',
    country: 'India',
    sourceUrl: indiaUrl,
    applyUrl: indiaUrl,
    jobId: 'JR1000054',
    requisitionId: 'JR1000054',
    department: 'Engineering',
    postingDate: '2026-09-25T21:18:18.856Z',
    jobDescription: 'Build AI tools for Postman.',
  })
})

test('Postman rejects incomplete or untrusted careers cache inventories', async () => {
  const postman = provider()
  for (const badPayload of [
    { ...payload, meta: { ...payload.meta, total: 3 } },
    { ...payload, jobs: [{ ...payload.jobs[0], title: '' }, payload.jobs[1]] },
    { ...payload, jobs: [{ ...payload.jobs[0], url: 'https://example.com/fake' }, payload.jobs[1]] },
  ]) {
    await assert.rejects(
      runApiPortalScraper({ provider: postman, fetchJson: async () => badPayload }),
      /inventory validation/i,
    )
  }
})

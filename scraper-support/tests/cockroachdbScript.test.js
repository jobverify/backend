import assert from 'node:assert/strict'
import test from 'node:test'

const samplePayload = {
  jobs: [
    {
      absolute_url: 'https://www.cockroachlabs.com/careers/job/?gh_jid=9100001',
      id: 9100001,
      title: 'Manager, Engineering',
      requisition_id: 'CRL-1001',
      first_published: '2026-07-24T10:00:00Z',
      content: '<p>Lead our Bangalore engineering team.</p>',
      location: { name: 'Bangalore, India' },
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Bangalore, India' }],
      metadata: [{ name: 'Country', value: ['India'] }],
    },
    {
      absolute_url: 'https://www.cockroachlabs.com/careers/job/?gh_jid=9100002',
      id: 9100002,
      title: 'Senior Partner Sales Manager, ISV & GSIs',
      requisition_id: 'CRL-1002',
      first_published: '2026-07-24T10:00:00Z',
      content: '<p>Drive partner growth in India.</p>',
      location: { name: 'Bangalore, India' },
      departments: [{ name: 'Sales' }],
      offices: [{ location: 'Bangalore, India' }],
      metadata: [{ name: 'Country', value: ['India'] }],
    },
    {
      absolute_url: 'https://www.cockroachlabs.com/careers/job/?gh_jid=9100003',
      id: 9100003,
      title: 'Director, Product Management',
      requisition_id: 'CRL-1003',
      first_published: '2026-07-24T10:00:00Z',
      content: '<p>US product leadership role.</p>',
      location: { name: 'New York, NY' },
      departments: [{ name: 'Product' }],
      offices: [{ location: 'New York, NY' }],
      metadata: [{ name: 'Country', value: ['United States'] }],
    },
  ],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cockroachdb/script.js')
  } catch {
    assert.fail('Expected CockroachDB scraper module at ../../scraper/cockroachdb/script.js')
  }
}

test('CockroachDB scraper keeps only India roles from the verified Greenhouse feed', async () => {
  const cockroachdb = await loadScriptModule()

  assert.equal(cockroachdb.isIndiaJob(samplePayload.jobs[0]), true)
  assert.equal(cockroachdb.isIndiaJob(samplePayload.jobs[1]), true)
  assert.equal(cockroachdb.isIndiaJob(samplePayload.jobs[2]), false)

  const extractedJobs = cockroachdb.extractJobsFromGreenhousePayload(samplePayload)
  assert.equal(extractedJobs.length, 2)
  assert.deepEqual(
    extractedJobs.map((job) => [job.title, job.location, job.department, job.country, job.sourceUrl]),
    [
      ['Manager, Engineering', 'Bangalore, India', 'Engineering', 'India', 'https://www.cockroachlabs.com/careers/job/?gh_jid=9100001'],
      ['Senior Partner Sales Manager, ISV & GSIs', 'Bangalore, India', 'Sales', 'India', 'https://www.cockroachlabs.com/careers/job/?gh_jid=9100002'],
    ],
  )

  const jobs = await cockroachdb.createCockroachDbScraper().run({
    fetchJson: async () => samplePayload,
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.country, job.source, job.link]),
    [
      ['Manager, Engineering', 'Bangalore, India', 'Engineering', 'India', 'cockroachdb', 'https://www.cockroachlabs.com/careers/job/?gh_jid=9100001'],
      ['Senior Partner Sales Manager, ISV & GSIs', 'Bangalore, India', 'Sales', 'India', 'cockroachdb', 'https://www.cockroachlabs.com/careers/job/?gh_jid=9100002'],
    ],
  )
})

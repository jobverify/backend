import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const SAMPLE_PAYLOAD = {
  jobs: [
    {
      absolute_url: 'https://job-boards.greenhouse.io/agoda/jobs/9000001',
      id: 9000001,
      requisition_id: 'AG-IND-1',
      title: 'Senior Software Engineer',
      first_published: '2026-07-24T10:00:00Z',
      content: '<p>Build Agoda products.</p>',
      location: { name: 'Gurugram, Haryana, India' },
      departments: [{ name: 'Technology' }],
    },
    {
      absolute_url: 'https://job-boards.greenhouse.io/agoda/jobs/9000002',
      id: 9000002,
      title: 'Software Engineer',
      location: { name: 'Bangkok, Thailand' },
    },
  ],
}

test('Agoda exact CSV name resolves to the official provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'agoda')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Agoda')
  assert.equal(provider.companyCareerPage, 'https://careersatagoda.com/vacancies/')
  assert.equal(provider.companyDomain, 'careersatagoda.com')
  assert.equal(provider.atsPlatform, 'greenhouse-board-api')
  assert.equal(provider.verifiedOn, '2026-07-25')

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nAgoda\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'agoda')
})

test('Agoda scraper keeps only complete India roles from the official feed', async () => {
  const { createAgodaScraper, extractJobsFromGreenhousePayload, isIndiaJob } =
    await import('../../scraper/agoda/script.js')

  assert.equal(isIndiaJob(SAMPLE_PAYLOAD.jobs[0]), true)
  assert.equal(isIndiaJob(SAMPLE_PAYLOAD.jobs[1]), false)
  assert.equal(extractJobsFromGreenhousePayload(SAMPLE_PAYLOAD).length, 1)

  const jobs = await createAgodaScraper().run({
    fetchJson: async () => SAMPLE_PAYLOAD,
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.country, job.source]),
    [['Senior Software Engineer', 'Gurugram, Haryana, India', 'Technology', 'India', 'agoda']],
  )
})

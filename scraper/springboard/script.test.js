import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GREENHOUSE_JOBS_API_URL,
  createSpringboardScraper,
  extractIndiaJobsFromGreenhousePayload,
} from './script.js'

test('Springboard Greenhouse extraction keeps only India roles on its canonical board', () => {
  const jobs = extractIndiaJobsFromGreenhousePayload({
    jobs: [
      {
        id: 100,
        company_name: 'Springboard Roles',
        title: 'Launch Operations Manager',
        absolute_url: 'https://job-boards.greenhouse.io/springboard/jobs/100?gh_src=ref',
        location: { name: 'Philippines & India (Remote - Full time)' },
        content: '<p>Coordinate launches.</p>',
      },
      {
        id: 101,
        company_name: 'Springboard Roles',
        title: 'B2B Marketing Lead',
        absolute_url: 'https://job-boards.greenhouse.io/springboard/jobs/101',
        location: { name: 'United States (Remote)' },
      },
    ],
  }, { scrapedAt: '2026-07-25T00:00:00.000Z' })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Launch Operations Manager')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, 'https://job-boards.greenhouse.io/springboard/jobs/100')
})

test('Springboard runs from its official ATS and fails closed when ATS identity changes', async () => {
  await assert.rejects(
    createSpringboardScraper().run({
      fetchJson: async (url) => {
        assert.equal(url, `${GREENHOUSE_JOBS_API_URL}?content=true`)
        return {
          jobs: [{
            id: 102,
            company_name: 'Springboard Enterprises',
            title: 'Different company role',
            absolute_url: 'https://job-boards.greenhouse.io/springboard/jobs/102',
            location: { name: 'Bengaluru, India' },
          }],
        }
      },
    }),
    /verified company identity/i,
  )
})

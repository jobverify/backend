import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'

const loadRattleScript = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Rattle scraper module at ./script.js')
  }
}

test('Rattle provider covers only the exact CSV company name', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rattle')

  assert.ok(provider, 'Expected Rattle provider extension to be loaded')
  assert.equal(provider.companyName, 'Rattle')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.companyCareerPage, 'https://job-boards.greenhouse.io/rattle')
  assert.equal(provider.companyDomain, 'gorattle.com')
  assert.equal(provider.atsPlatform, 'greenhouse')

  const report = generateCompanyCoverageReport({
    csvText: 'Rattle\nBig Rattle\nRattle Research\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Rattle', 'rattle']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Big Rattle', 'Rattle Research'],
  )
})

test('Rattle Greenhouse scraper retains only exact-identity India jobs and fails closed', async () => {
  const {
    GREENHOUSE_JOBS_API_URL,
    buildGreenhouseJobsApiUrl,
    createRattleScraper,
    extractIndiaJobsFromGreenhousePayload,
  } = await loadRattleScript()

  assert.equal(GREENHOUSE_JOBS_API_URL, 'https://boards-api.greenhouse.io/v1/boards/rattle/jobs')
  assert.equal(buildGreenhouseJobsApiUrl(), `${GREENHOUSE_JOBS_API_URL}?content=true`)

  const jobs = extractIndiaJobsFromGreenhousePayload({
    jobs: [
      {
        id: 101,
        title: 'Fullstack Engineer',
        company_name: 'Rattle',
        absolute_url: 'https://job-boards.greenhouse.io/rattle/jobs/101?gh_src=test',
        location: { name: 'Bangalore, India' },
        departments: [{ name: 'Engineering' }],
        content: '<p>Build Rattle.</p>',
      },
      {
        id: 102,
        title: 'Founding Account Executive',
        company_name: 'Rattle',
        absolute_url: 'https://job-boards.greenhouse.io/rattle/jobs/102',
        location: { name: 'San Francisco, CA' },
      },
    ],
  }, { scrapedAt: '2026-07-25T18:00:00.000Z' })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Rattle')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.equal(jobs[0].link, 'https://job-boards.greenhouse.io/rattle/jobs/101')

  await assert.rejects(
    createRattleScraper().run({
      fetchJson: async () => ({
        jobs: [{
          id: 103,
          title: 'Lookalike role',
          company_name: 'Big Rattle',
          absolute_url: 'https://job-boards.greenhouse.io/rattle/jobs/103',
          location: { name: 'Bengaluru, India' },
        }],
      }),
    }),
    /verified company identity/i,
  )

  assert.throws(
    () => extractIndiaJobsFromGreenhousePayload({ jobs: [{
      id: 104,
      title: 'Unexpected route',
      company_name: 'Rattle',
      absolute_url: 'https://job-boards.greenhouse.io/another-company/jobs/104',
      location: { name: 'Bengaluru, India' },
    }] }),
    /verified Greenhouse detail route/i,
  )
})

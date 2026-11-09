import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Tower Research Capital</title>
  </head>
  <body>
    <h1>Build Your Career at Tower</h1>
    <p>Continuous investment in top trading and engineering talent is our not-so-secret sauce.</p>
    <p>Explore our open roles and move one step closer to reaching your full potential.</p>
  </body>
</html>
`

const rolesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Roles - Tower Research Capital</title>
  </head>
  <body>
    <p>Explore open roles across our departments and global offices.</p>
    <script src="https://boards.greenhouse.io/embed/job_board/js?for=towerresearchcapital"></script>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      absolute_url: 'https://www.tower-research.com/open-positions/?gh_jid=7704976',
      company_name: 'Tower Research Capital',
      location: { name: 'Gurgaon, India' },
      metadata: [{ name: 'Country', value: 'India' }],
      id: 7704976,
      title: 'AI Operations Manager',
      departments: [{ name: 'Engineering' }],
      content: '<p>Hybrid role in Gurgaon.</p>',
      requisition_id: 'REQ-7704976',
      updated_at: '2026-08-01T12:00:00Z',
      offices: [],
    },
  ],
}

const mixedLocationPayload = {
  jobs: [
    {
      absolute_url: 'https://www.tower-research.com/open-positions/?gh_jid=16619',
      company_name: 'Tower Research Capital',
      location: { name: 'Multiple Locations' },
      metadata: null,
      id: 16619,
      title: 'Experienced Quantitative Trader',
      departments: [{ name: 'Quantitative Research & Trading' }],
      content: '<p>Hybrid role.</p>',
      requisition_id: '798',
      updated_at: '2026-08-01T12:00:00Z',
      offices: [
        { location: 'Amsterdam, Noord-Holland, Netherlands' },
        { location: 'Gurgaon, Haryana, India' },
      ],
    },
  ],
}

test('Tower Research Capital recognizes the current careers landing copy and Greenhouse-backed roles page', async () => {
  const tower = await loadModule()

  assert.equal(tower.hasOfficialCareersLandingSignal(careersHtml), true)
  assert.equal(tower.hasVerifiedRolesPageSignal(rolesHtml), true)
})

test('Tower Research Capital extracts India jobs from the verified Greenhouse payload', async () => {
  const tower = await loadModule()

  const jobs = await tower.createTowerResearchCapitalScraper().run({
    fetchText: async (url) => {
      if (url === tower.CAREERS_URL) return careersHtml
      if (url === tower.ROLES_URL) return rolesHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async () => greenhousePayload,
    now: () => '2026-08-06T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'AI Operations Manager')
  assert.equal(jobs[0].location, 'Gurgaon, India')
  assert.equal(jobs[0].link, 'https://www.tower-research.com/open-positions/?gh_jid=7704976')
})

test('Tower Research Capital chooses the actual India office for mixed-location roles instead of misclassifying non-India offices', async () => {
  const tower = await loadModule()

  const jobs = tower.extractIndiaJobsFromGreenhousePayload(mixedLocationPayload, {
    scrapedAt: '2026-08-06T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Gurgaon, Haryana, India')
  assert.equal(jobs[0].city, 'Gurgaon')
})

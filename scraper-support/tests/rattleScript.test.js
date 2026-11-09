import assert from 'node:assert/strict'
import test from 'node:test'

const officialSiteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rattle - Sales Execution Platform</title>
  </head>
  <body>
    <h1>The AI layer your CRM always needed</h1>
    <p>A new product by Rattle</p>
    <p>Meet Von: The AI data scientist for revenue teams</p>
    <footer>
      <a href="https://boards.greenhouse.io/rattle" target="_blank">Careers</a>
    </footer>
  </body>
</html>
`

const missingBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found</title>
    <meta name="robots" content="noindex">
  </head>
  <body>
    <main>Page not found</main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 123,
      company_name: 'Rattle',
      title: 'Technical Support Specialist',
      absolute_url: 'https://job-boards.greenhouse.io/rattle/jobs/123',
      location: { name: 'Bangalore, India' },
      departments: [{ name: 'Customer Success' }],
      requisition_id: 'RAT-123',
      content: '<p>Support customers in India.</p>',
      updated_at: '2026-08-01T00:00:00.000Z',
    },
  ],
}

const loadRattleModule = async () => {
  try {
    return await import('../../scraper/rattle/script.js')
  } catch {
    assert.fail('Expected Rattle scraper module at ../../scraper/rattle/script.js')
  }
}

test('Rattle validates both the Greenhouse payload path and the official-site dead-board sentinel path', async () => {
  const rattle = await loadRattleModule()

  assert.equal(rattle.SOURCE, 'rattle')
  assert.equal(rattle.COMPANY, 'Rattle')
  assert.equal(rattle.OFFICIAL_SITE_URL, 'https://www.gorattle.com/')
  assert.equal(rattle.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/rattle')
  assert.equal(rattle.hasOfficialSiteSignal(officialSiteHtml), true)
  assert.equal(
    rattle.extractOfficialCareersLink(officialSiteHtml),
    rattle.GREENHOUSE_BOARD_URL,
  )
  assert.equal(
    rattle.isVerifiedMissingGreenhouseBoardPage({
      status: 404,
      url: rattle.GREENHOUSE_BOARD_URL,
      html: missingBoardHtml,
    }),
    true,
  )
})

test('Rattle still parses India jobs when the Greenhouse API remains available', async () => {
  const rattle = await loadRattleModule()

  const jobs = await rattle.createRattleScraper().run({
    fetchJson: async () => greenhousePayload,
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Technical Support Specialist')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
})

test('Rattle returns [] when the official site still points to a dead Greenhouse board', async () => {
  const rattle = await loadRattleModule()
  const requestedPages = []

  const jobs = await rattle.createRattleScraper().run({
    fetchJson: async () => {
      throw new Error(`HTTP 404 for ${rattle.buildGreenhouseJobsApiUrl()}`)
    },
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === rattle.OFFICIAL_SITE_URL) {
        return { status: 200, url, html: officialSiteHtml }
      }

      if (url === rattle.GREENHOUSE_BOARD_URL) {
        return { status: 404, url, html: missingBoardHtml }
      }

      throw new Error(`Unexpected Rattle page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    rattle.OFFICIAL_SITE_URL,
    rattle.GREENHOUSE_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

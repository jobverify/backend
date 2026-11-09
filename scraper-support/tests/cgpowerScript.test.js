import assert from 'node:assert/strict'
import test from 'node:test'

const loadCgPowerModule = async () => {
  try {
    return await import('../../scraper/cgpower/script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
  <html>
    <body>
      <h1>Join a Purpose-Driven Team</h1>
      <a href="/explore_roles">Explore Open Positions</a>
    </body>
  </html>
`

const exploreRolesHtml = `
  <html>
    <body>
      <h2>Explore the Latest Job Opportunities</h2>
      <input placeholder="Search all open positions..." />
      <p>Loading</p>
      <p>No Jobs Found</p>
    </body>
  </html>
`

test('extractOpenings returns no jobs when the public CG Power roles page shows the official empty-state', async () => {
  const cgpower = await loadCgPowerModule()
  assert.ok(cgpower)

  assert.equal(cgpower.hasCareerPageSignal(careerPageHtml), true)
  assert.equal(cgpower.hasExploreRolesSignal(exploreRolesHtml), true)
  assert.equal(cgpower.hasNoJobsSignal(exploreRolesHtml), true)
  assert.deepEqual(cgpower.extractOpenings(exploreRolesHtml), [])
})

test('run fetches the official CG Power careers pages and returns an honest zero-openings result', async () => {
  const cgpower = await loadCgPowerModule()
  assert.ok(cgpower)

  const requestedUrls = []
  const jobs = await cgpower.createCgPowerScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://www.cgglobal.com/career') {
        return careerPageHtml
      }

      if (url === 'https://www.cgglobal.com/explore_roles') {
        return exploreRolesHtml
      }

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.cgglobal.com/career',
    'https://www.cgglobal.com/explore_roles',
  ])
  assert.deepEqual(jobs, [])
})

test('run returns [] while the Thursday, August 20, 2026 CG Power first-party career hosts remain unresolved', async () => {
  const cgpower = await loadCgPowerModule()
  assert.ok(cgpower)

  const requestedUrls = []
  const jobs = await cgpower.createCgPowerScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      const error = new TypeError('fetch failed')
      error.cause = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND www.cgglobal.com',
      }
      throw error
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.cgglobal.com/career',
    'https://www.cgglobal.com/explore_roles',
  ])
  assert.deepEqual(jobs, [])
})

import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Junglee Games</title>
  </head>
  <body>
    <h1>Play To Grow</h1>
    <h2>Join Our Team</h2>
    <p>Build intelligent, fair, and responsible entertaining ecosystems with a culture driven by technological ingenuity.</p>
    <a href="/grow.php">View All Jobs</a>
    <p>Junglee Games India Private Limited</p>
  </body>
</html>
`

const GROW_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Our Existing Openings to Join | Jungleegames.com</title>
  </head>
  <body>
    <h1>In What Field Would You Like to Grow?</h1>
    <h3>ALL JOBS</h3>
    <p>Browse every open role and find the best fit for your journey.</p>
    <p>View all jobs</p>
    <p>GPTW Certified</p>
  </body>
</html>
`

const EMPTY_DEPARTMENT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Our Existing Openings to Join | Jungleegames.com</title>
  </head>
  <body>
    <p>If you think you are ready to be part of a dynamic, versatile and young workforce, apply for our existing openings.</p>
    <p>View all jobs</p>
    <p>No Open Roles In This Department</p>
    <p>View All Other Open Roles</p>
    <p>All Jobs</p>
  </body>
</html>
`

const PUBLIC_ROLE_LIST_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Our Existing Openings to Join | Jungleegames.com</title>
  </head>
  <body>
    <p>If you think you are ready to be part of a dynamic, versatile and young workforce, apply for our existing openings.</p>
    <h3>Legal Intern</h3>
    <p>Location: Gurgaon, Haryāna, India</p>
    <p>Apply Now</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/jungleegames/script.js')
  } catch {
    assert.fail('Expected Junglee Games scraper module at ../../scraper/jungleegames/script.js')
  }
}

test('Junglee Games helpers stay pinned to the verified empty-index first-party careers surface', async () => {
  const jungleeGames = await loadModule()

  assert.equal(jungleeGames.SOURCE, 'jungleegames')
  assert.equal(jungleeGames.COMPANY, 'Junglee Games')
  assert.equal(jungleeGames.HOMEPAGE_URL, 'https://www.jungleegames.com/')
  assert.equal(jungleeGames.GROW_PAGE_URL, 'https://www.jungleegames.com/grow.php')
  assert.equal(
    jungleeGames.VERIFIED_EMPTY_DEPARTMENT_URL,
    'https://www.jungleegames.com/grow-inner-page.php?id=56613313BB',
  )
  assert.equal(jungleeGames.COMPANY_DOMAIN, 'jungleegames.com')
  assert.equal(jungleeGames.VERIFIED_ON, '2026-08-02')
  assert.equal(jungleeGames.extractGrowPageUrl(HOMEPAGE_HTML), jungleeGames.GROW_PAGE_URL)
  assert.equal(jungleeGames.hasVerifiedHomepageSignals(HOMEPAGE_HTML), true)
  assert.equal(jungleeGames.hasVerifiedGrowPageSignals(GROW_PAGE_HTML), true)
  assert.equal(jungleeGames.hasVerifiedEmptyDepartmentSignals(EMPTY_DEPARTMENT_HTML), true)
  assert.equal(jungleeGames.hasPublicJobSignals(EMPTY_DEPARTMENT_HTML), false)
  assert.equal(jungleeGames.hasPublicJobSignals(PUBLIC_ROLE_LIST_HTML), true)
})

test('Junglee Games returns [] while the verified first-party grow surface has no trustworthy current jobs index', async () => {
  const jungleeGames = await loadModule()
  const requestedUrls = []

  const jobs = await jungleeGames.createJungleeGamesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === jungleeGames.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === jungleeGames.GROW_PAGE_URL) return GROW_PAGE_HTML
      if (url === jungleeGames.VERIFIED_EMPTY_DEPARTMENT_URL) return EMPTY_DEPARTMENT_HTML
      throw new Error(`Unexpected Junglee Games URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    jungleeGames.HOMEPAGE_URL,
    jungleeGames.GROW_PAGE_URL,
    jungleeGames.VERIFIED_EMPTY_DEPARTMENT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Junglee Games fails closed when the verified grow surface starts exposing a public role list', async () => {
  const jungleeGames = await loadModule()

  await assert.rejects(
    jungleeGames.run({
      fetchText: async (url) => {
        if (url === jungleeGames.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === jungleeGames.GROW_PAGE_URL) return GROW_PAGE_HTML
        if (url === jungleeGames.VERIFIED_EMPTY_DEPARTMENT_URL) return PUBLIC_ROLE_LIST_HTML
        throw new Error(`Unexpected Junglee Games URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})

test('Junglee Games returns [] when the exact-name grow surface is fully unreachable by transport timeout', async () => {
  const jungleeGames = await loadModule()
  const requestedUrls = []

  const jobs = await jungleeGames.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      throw new TypeError(`fetch failed | Connect Timeout Error (attempted address: www.jungleegames.com:443, timeout: 10000ms) for ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    jungleeGames.HOMEPAGE_URL,
    jungleeGames.GROW_PAGE_URL,
    jungleeGames.VERIFIED_EMPTY_DEPARTMENT_URL,
  ])
  assert.deepEqual(jobs, [])
})

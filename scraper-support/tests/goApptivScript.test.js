import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>GoApptiv | Improving Access to Primary Healthcare in India</title>
  </head>
  <body>
    <main>
      <h1>Improving access to Primary Healthcare and Quality Medication across India</h1>
      <p>India's leading tech enabled Go-To-Market (GTM) Specialist for Healthcare Companies</p>
      <a href="https://www.goapptiv.com/teamandculture">The Team</a>
      <p>business@goapptiv.com</p>
      <p>grievances@goapptiv.com</p>
    </main>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>GoApptiv | Improving Access to Primary Healthcare in India</title>
  </head>
  <body>
    <main>
      <h1>Improving access to Primary Healthcare and Quality Medicines across India</h1>
      <p>India's leading tech-enabled Go-To-Market (GTM) Specialist for Healthcare Companies</p>
      <a href="https://www.goapptiv.com/teamandculture">The Team</a>
      <p>business@goapptiv.com</p>
      <p>grievances@goapptiv.com</p>
    </main>
  </body>
</html>
`

const teamCultureHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Team & Culture | GA</title>
  </head>
  <body>
    <main>
      <h2>The Core Values</h2>
      <h3>Meet The Leadership Team</h3>
      <p>Rajasekhar Parcha</p>
      <p>Sreeram Venkitaraman</p>
      <p>business@goapptiv.com</p>
      <p>grievances@goapptiv.com</p>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page Not Found</title>
  </head>
  <body>
    <main>
      <h1>Looks like this page does not exist</h1>
      <a href="https://www.goapptiv.com/teamandculture">The Team</a>
      <p>business@goapptiv.com</p>
      <p>grievances@goapptiv.com</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>Current openings</h2>
      <a href="https://jobs.lever.co/goapptiv/senior-manager">Apply now</a>
    </main>
  </body>
</html>
`

const loadGoApptivModule = async () => {
  try {
    return await import('../../scraper/goapptiv/script.js')
  } catch {
    assert.fail('Expected GoApptiv scraper module at ../../scraper/goapptiv/script.js')
  }
}

test('GoApptiv sentinel pins the verified homepage, team page, and missing careers routes from July 16, 2026', async () => {
  const goApptiv = await loadGoApptivModule()

  assert.equal(goApptiv.SOURCE, 'goapptiv')
  assert.equal(goApptiv.COMPANY, 'GoApptiv')
  assert.equal(goApptiv.OFFICIAL_BRAND_NAME, 'GoApptiv')
  assert.equal(goApptiv.VERIFIED_ON, '2026-07-16')
  assert.equal(goApptiv.HOMEPAGE_URL, 'https://www.goapptiv.com/')
  assert.equal(goApptiv.TEAM_CULTURE_URL, 'https://www.goapptiv.com/teamandculture')
  assert.deepEqual(goApptiv.CAREERS_ROUTE_URLS, [
    'https://www.goapptiv.com/careers',
    'https://www.goapptiv.com/career',
    'https://www.goapptiv.com/jobs',
    'https://www.goapptiv.com/hiring',
  ])
  assert.match(goApptiv.VERIFIED_SURFACE_SUMMARY, /no trustworthy public job listings/i)

  assert.equal(goApptiv.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(goApptiv.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(goApptiv.hasOfficialTeamCultureSignal(teamCultureHtml), true)
  assert.equal(goApptiv.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(goApptiv.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    goApptiv.isVerifiedMissingFirstPartyRoute({
      ok: false,
      status: 404,
      url: goApptiv.CAREERS_ROUTE_URLS[0],
      text: missingRouteHtml,
    }),
    true,
  )
})

test('GoApptiv sentinel returns [] only while the verified no-public-careers surface remains unchanged', async () => {
  const goApptiv = await loadGoApptivModule()
  const requestedUrls = []

  const jobs = await goApptiv.createGoApptivScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === goApptiv.HOMEPAGE_URL) {
        return { ok: true, status: 200, url, text: homepageHtml }
      }

      if (url === goApptiv.TEAM_CULTURE_URL) {
        return { ok: true, status: 200, url, text: teamCultureHtml }
      }

      if (goApptiv.CAREERS_ROUTE_URLS.includes(url)) {
        return { ok: false, status: 404, url, text: missingRouteHtml }
      }

      throw new Error(`Unexpected GoApptiv URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    goApptiv.HOMEPAGE_URL,
    goApptiv.TEAM_CULTURE_URL,
    ...goApptiv.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('GoApptiv sentinel fails closed when the verified surface drifts into a public jobs board', async () => {
  const goApptiv = await loadGoApptivModule()

  await assert.rejects(
    goApptiv.createGoApptivScraper().run({
      fetchPage: async (url) => {
        if (url === goApptiv.HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected GoApptiv URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified first-party surface/i,
  )

  await assert.rejects(
    goApptiv.createGoApptivScraper().run({
      fetchPage: async (url) => {
        if (url === goApptiv.HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: homepageHtml }
        }

        if (url === goApptiv.TEAM_CULTURE_URL) {
          return { ok: true, status: 200, url, text: publicJobsHtml }
        }

        throw new Error(`Unexpected GoApptiv URL: ${url}`)
      },
    }),
    /team and culture page now appears to expose public job listings/i,
  )

  await assert.rejects(
    goApptiv.createGoApptivScraper().run({
      fetchPage: async (url) => {
        if (url === goApptiv.HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: homepageHtml }
        }

        if (url === goApptiv.TEAM_CULTURE_URL) {
          return { ok: true, status: 200, url, text: teamCultureHtml }
        }

        if (url === goApptiv.CAREERS_ROUTE_URLS[0]) {
          return { ok: true, status: 200, url, text: publicJobsHtml }
        }

        return { ok: false, status: 404, url, text: missingRouteHtml }
      },
    }),
    /careers route changed materially or now exposes public job listings/i,
  )
})

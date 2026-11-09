import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/golivegamesstudios/fixtures',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readHtmlFixture('homepage.html')
const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Welcome to GoLive Games</title>
  </head>
  <body>
    <main>
      <h1>Bridging the world through games</h1>
      <p>GoLive Games is the world’s favourite game publisher of casual and mid-core games.</p>
      <p>Publish@golive.games</p>
      <p>India 106, Vindhya C5, IIIT Hyderabad, Gachibowli, Hyderabad, Telangana - 500032.</p>
    </main>
  </body>
</html>
`

const loadGoLiveGamesStudiosModule = async () => {
  try {
    return await import('../../scraper/golivegamesstudios/script.js')
  } catch {
    assert.fail('Expected GoLive Games Studios scraper module at ../../scraper/golivegamesstudios/script.js')
  }
}

test('GoLive Games Studios validates the verified homepage and recognized missing first-party careers routes', async () => {
  const goLiveGamesStudios = await loadGoLiveGamesStudiosModule()

  assert.equal(goLiveGamesStudios.SOURCE, 'golivegamesstudios')
  assert.equal(goLiveGamesStudios.COMPANY, 'GoLive Games Studios')
  assert.equal(goLiveGamesStudios.HOMEPAGE_URL, 'https://www.golive.games/')
  assert.deepEqual(goLiveGamesStudios.CAREERS_ROUTE_URLS, [
    'https://www.golive.games/careers',
    'https://www.golive.games/careers/',
    'https://www.golive.games/career',
    'https://www.golive.games/career/',
    'https://www.golive.games/jobs',
    'https://www.golive.games/jobs/',
  ])
  assert.equal(goLiveGamesStudios.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(goLiveGamesStudios.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(goLiveGamesStudios.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(
    goLiveGamesStudios.isVerifiedMissingCareersRoute({
      status: 404,
      url: 'https://www.golive.games/careers',
      headers: {},
      html: '',
    }),
    true,
  )
  assert.equal(
    goLiveGamesStudios.isVerifiedMissingCareersRoute({
      status: 200,
      url: 'https://www.golive.games/careers',
      headers: {},
      html: '<html><body><h1>Careers</h1><a href="/job/game-designer">Apply now</a></body></html>',
    }),
    false,
  )
})

test('GoLive Games Studios returns no jobs only while the verified homepage and missing-careers-route contract still holds', async () => {
  const goLiveGamesStudios = await loadGoLiveGamesStudiosModule()
  const requestedUrls = []

  const jobs = await goLiveGamesStudios.createGoLiveGamesStudiosScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === goLiveGamesStudios.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: verifiedHomepageHtml,
        }
      }

      if (goLiveGamesStudios.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          headers: {},
          html: '',
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    goLiveGamesStudios.HOMEPAGE_URL,
    ...goLiveGamesStudios.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('GoLive Games Studios fails closed when the verified homepage or missing-careers-route contract changes', async () => {
  const goLiveGamesStudios = await loadGoLiveGamesStudiosModule()

  await assert.rejects(
    goLiveGamesStudios.createGoLiveGamesStudiosScraper().run({
      fetchPage: async (url) => {
        if (url === goLiveGamesStudios.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Unexpected homepage</h1></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: '',
        }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    goLiveGamesStudios.createGoLiveGamesStudiosScraper().run({
      fetchPage: async (url) => {
        if (url === goLiveGamesStudios.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedHomepageHtml,
          }
        }

        if (url === goLiveGamesStudios.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Careers</h1><a href="/job/game-designer">Apply now</a></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: '',
        }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )

  await assert.rejects(
    goLiveGamesStudios.createGoLiveGamesStudiosScraper().run({
      fetchPage: async (url) => {
        if (url === goLiveGamesStudios.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: `${verifiedHomepageHtml}<a href="https://jobs.ashbyhq.com/golive">Open positions</a>`,
          }
        }

        return {
          status: 404,
          url,
          headers: {},
          html: '',
        }
      },
    }),
    /homepage now appears to expose a public jobs surface/i,
  )
})

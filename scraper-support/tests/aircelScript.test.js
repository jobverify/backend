import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aircel - Moile Service Provider</title>
    <meta name="description" content="Aircel website">
    <meta name="author" content="Arun Mahajan">
  </head>
  <body>
    <a href="0_webportal_2022/nclt.html">Latest update</a>
    <p>Aircel website</p>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aircel - Moile Service Provider</title>
    <meta content="Aircel website" name="description">
    <meta content="Arun Mahajan" name="author">
  </head>
  <body>
    <a href=0_webportal_2022/nclt.html>Latest update</a>
    <p>Aircel website</p>
  </body>
</html>
`

const liveMinimalHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aircel - Moile Service Provider</title>
    <meta name="description" content="Aircel website">
    <meta name="author" content="Arun Mahajan">
  </head>
  <body>
    <map name="workmap">
      <area shape="rect" href="0_webportal_2022/nclt.html">
    </map>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aircel Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://aircel.com/apply">Apply now</a>
  </body>
</html>
`

const loadAircelModule = async () => {
  try {
    return await import('../../scraper/aircel/script.js')
  } catch {
    assert.fail('Expected Aircel scraper module at ../../scraper/aircel/script.js')
  }
}

test('Aircel scraper constants stay pinned to the verified first-party no-public-careers surface from July 15, 2026', async () => {
  const aircel = await loadAircelModule()

  assert.equal(aircel.SOURCE, 'aircel')
  assert.equal(aircel.COMPANY, 'Aircel')
  assert.equal(aircel.VERIFIED_ON, '2026-07-15')
  assert.equal(aircel.HOMEPAGE_URL, 'https://aircel.com/')
  assert.deepEqual(aircel.CAREERS_ROUTE_URLS, [
    'https://aircel.com/careers',
    'https://aircel.com/career',
    'https://aircel.com/jobs',
    'https://aircel.com/join-us',
    'https://aircel.com/openings',
  ])
  assert.deepEqual(aircel.CRAWL_SURFACE_URLS, [
    'https://aircel.com/robots.txt',
    'https://aircel.com/sitemap.xml',
  ])
  assert.match(aircel.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(aircel.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aircel.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(aircel.hasOfficialHomepageSignal(liveMinimalHomepageHtml), true)
  assert.equal(aircel.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(aircel.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(aircel.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(aircel.hasFirstPartyCareerLikeLink('<a href="https://aircel.com/careers">Careers</a>'), true)
  assert.equal(
    aircel.isMissingCareerRoute({
      status: 404,
      url: aircel.CAREERS_ROUTE_URLS[0],
      html: '',
    }),
    true,
  )
})

test('Aircel returns [] only while the verified first-party surface exposes no public jobs board', async () => {
  const aircel = await loadAircelModule()
  const requestedUrls = []

  const jobs = await aircel.createAircelScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aircel.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (aircel.CAREERS_ROUTE_URLS.includes(url) || aircel.CRAWL_SURFACE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected Aircel URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aircel.HOMEPAGE_URL,
    ...aircel.CAREERS_ROUTE_URLS,
    ...aircel.CRAWL_SURFACE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Aircel fails closed when the verified homepage or checked missing routes drift into a public jobs surface', async () => {
  const aircel = await loadAircelModule()

  await assert.rejects(
    aircel.createAircelScraper().run({
      fetchPage: async (url) => {
        if (url === aircel.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Aircel URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aircel.createAircelScraper().run({
      fetchPage: async (url) => {
        if (url === aircel.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="https://aircel.com/careers">Careers</a>`,
          }
        }

        throw new Error(`Unexpected Aircel URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    aircel.createAircelScraper().run({
      fetchPage: async (url) => {
        if (url === aircel.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aircel.CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})

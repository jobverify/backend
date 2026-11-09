import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Web Accessibility, Marketing & Data Solutions | Tranistics</title>
  </head>
  <body>
    <header>Tranistics</header>
    <main>
      <h1>Your Business. Our Responsibility.</h1>
      <p>Tranistics: Revolutionizing transportation and logistics with comprehensive business supports services.</p>
      <a href="https://www.tranistics.com/contact-us/">Contact Us</a>
    </main>
    <footer>Copyright © 2026 Tranistics Data Technologies Pvt. Ltd, All rights reserved.</footer>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us - Tranistics Data Technologies</title>
  </head>
  <body>
    <h1>Contact Us</h1>
    <p>info@tranistics.com</p>
    <p>Kolkata</p>
    <p>Noida</p>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head><title>Not Found</title></head>
  <body><div>404</div></body>
</html>
`

const loadTranisticsModule = async () => {
  try {
    return await import('../../scraper/tranisticsdatatechnologies/script.js')
  } catch {
    assert.fail('Expected Tranistics Data Technologies scraper module at ../../scraper/tranisticsdatatechnologies/script.js')
  }
}

test('Tranistics Data Technologies sentinel returns [] only while the verified first-party surface exposes no public careers board', async () => {
  const tranistics = await loadTranisticsModule()
  const requestedUrls = []

  assert.equal(tranistics.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(tranistics.hasOfficialContactSignal(contactHtml), true)
  assert.equal(tranistics.hasPublicJobsSignal(homepageHtml), false)

  const jobs = await tranistics.createTranisticsDataTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === tranistics.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === tranistics.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (tranistics.CAREERS_ROUTE_URLS.includes(url)) return { status: 404, url, html: missingRouteHtml }

      throw new Error(`Unexpected Tranistics URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    tranistics.HOMEPAGE_URL,
    tranistics.CONTACT_URL,
    ...tranistics.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Tranistics Data Technologies sentinel fails closed when a first-party careers route appears', async () => {
  const tranistics = await loadTranisticsModule()

  await assert.rejects(
    tranistics.createTranisticsDataTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === tranistics.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === tranistics.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === tranistics.CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1><a href="/apply">Apply Now</a></body></html>' }
        }
        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )
})

test('Tranistics Data Technologies sentinel fails closed when homepage identity drifts', async () => {
  const tranistics = await loadTranisticsModule()

  await assert.rejects(
    tranistics.createTranisticsDataTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === tranistics.HOMEPAGE_URL) return { status: 200, url, html: '<html><body>Unknown</body></html>' }
        throw new Error(`Unexpected Tranistics URL: ${url}`)
      },
    }),
    /homepage surface no longer matches/i,
  )
})

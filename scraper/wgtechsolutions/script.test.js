import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_URL,
  CAREERS_ROUTE_URLS,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createWgTechSolutionsScraper,
  hasOfficialAboutSignal,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  isVerifiedNoPublicJobsRoute,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Revolutionizing Edge AI: Building, Training and Product Deployment of AI models at the Edge | WG Tech Solutions</title>
      <meta property="og:url" content="https://www.wgtechsolutions.com/">
    </head>
    <body>
      <header>
        <a href="/">WG Tech Solutions</a>
        <a href="/about-us">About Us</a>
        <a href="/contact-us">Contact Us</a>
      </header>
      <main>
        <h1>Solve Real-World Problems Using AI !!</h1>
        <p>Experience power of automation and AI meeting your organizations budget and ROI.</p>
        <p>WGTech AI in Action: Transforming Industries</p>
        <p>WG Tech Solutions Pvt Ltd</p>
        <p>support@wgtech.ai</p>
      </main>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <head>
      <title>About Us | WG Tech Solutions</title>
      <meta property="og:url" content="https://www.wgtechsolutions.com/about-us">
    </head>
    <body>
      <main>
        <h1>About Us</h1>
        <p>WGTech is a privately owned technology company focused on providing cutting-edge AI services to build, train and deploy custom AI models at the Edge.</p>
        <p>Our end markets include Industrial, Agriculture, Medical and Automotive businesses.</p>
        <p>WG Tech Solutions Pvt Ltd</p>
        <p>support@wgtech.ai</p>
      </main>
    </body>
  </html>
`

const notFoundRoute = {
  status: 404,
  url: 'https://www.wgtechsolutions.com/careers',
  html: '<html><body><h1>404</h1><p>Page not found</p></body></html>',
}

const redirectedHomepageRoute = {
  status: 200,
  url: HOMEPAGE_URL,
  html: homepageHtml,
}

const publicJobsRoute = {
  status: 200,
  url: 'https://www.wgtechsolutions.com/jobs',
  html: '<html><body><h1>Current Openings</h1><a href="/jobs/ml-engineer">Apply now</a></body></html>',
}

test('WG Tech Solutions sentinel pins the verified official homepage, about page, and common careers routes', () => {
  assert.equal(SOURCE, 'wgtechsolutions')
  assert.equal(COMPANY, 'WG Tech Solutions')
  assert.equal(HOMEPAGE_URL, 'https://www.wgtechsolutions.com/')
  assert.equal(ABOUT_URL, 'https://www.wgtechsolutions.com/about-us')
  assert.equal(CAREERS_ROUTE_URLS.length, 8)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(hasPublicJobsSignal(publicJobsRoute.html), true)
})

test('isVerifiedNoPublicJobsRoute accepts 404s and official marketing-shell fallbacks but rejects public job pages', () => {
  assert.equal(isVerifiedNoPublicJobsRoute(notFoundRoute), true)
  assert.equal(isVerifiedNoPublicJobsRoute(redirectedHomepageRoute), true)
  assert.equal(isVerifiedNoPublicJobsRoute(publicJobsRoute), false)
})

test('run returns an empty list only while WG Tech Solutions keeps the verified no-listing surface', async () => {
  const requestedUrls = []
  const scraper = createWgTechSolutionsScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return {
          status: 200,
          url: HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === ABOUT_URL) {
        return {
          status: 200,
          url: ABOUT_URL,
          html: aboutHtml,
        }
      }

      return {
        ...notFoundRoute,
        url,
      }
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, ABOUT_URL, ...CAREERS_ROUTE_URLS])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified homepage, about page, or careers routes drift into a jobs surface', async () => {
  await assert.rejects(
    createWgTechSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url: HOMEPAGE_URL,
            html: '<html><body><h1>WG Tech Solutions</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    createWgTechSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url: HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === ABOUT_URL) {
          return {
            status: 200,
            url: ABOUT_URL,
            html: aboutHtml.replace('support@wgtech.ai', 'jobs@wgtech.ai'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /about page no longer matches/i,
  )

  await assert.rejects(
    createWgTechSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url: HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === ABOUT_URL) {
          return {
            status: 200,
            url: ABOUT_URL,
            html: aboutHtml,
          }
        }

        return {
          status: 200,
          url,
          html: publicJobsRoute.html,
        }
      },
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})

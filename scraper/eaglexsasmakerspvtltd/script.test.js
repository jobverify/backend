import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_URL,
  CAREERS_ROUTE_URLS,
  COMPANY,
  CONTACT_URL,
  HOMEPAGE_URL,
  SOURCE,
  VERIFIED_AT,
  createEaglexSasMakersScraper,
  hasOfficialAboutPageSignal,
  hasOfficialContactPageSignal,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  isVerifiedMissingCareersRoute,
} from './script.js'

const buildOfficialPageHtml = ({
  body = '',
  includeCareerLink = false,
} = {}) => `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Eagle X | We Engineer Dominance</title>
      <meta name="description" content="Eagle X is a high-performance software engineering studio that builds production-ready digital products in 7 days." />
      <link rel="canonical" href="https://eagle-x.in" />
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "name": "Eagle X",
              "alternateName": ["EagleX", "Eagle X Systems"],
              "url": "https://eagle-x.in",
              "contactPoint": [
                {
                  "@type": "ContactPoint",
                  "email": "eaglexdevelopment@gmail.com"
                }
              ]
            }
          ]
        }
      </script>
    </head>
    <body>
      <nav>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        ${includeCareerLink ? '<a href="/careers">Careers</a>' : ''}
      </nav>
      <main>
        <h1>Eagle X Systems</h1>
        <p>We Engineer Dominance</p>
        <p>production-ready digital products in 7 days</p>
        <p>Launch Initiative 2026</p>
        <p>eaglexdevelopment@gmail.com</p>
        <p>Indore, Madhya Pradesh, India</p>
        ${body}
      </main>
      <footer>© 2026 Eagle X Systems. All rights reserved.</footer>
    </body>
  </html>
`

const buildCurrentOfficialPageHtml = ({
  body = '',
} = {}) => `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Eagle X | We Engineer Dominance</title>
      <link rel="canonical" href="https://www.eaglex.co.in/" />
    </head>
    <body>
      <nav>
        <a href="/work">Our Work</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/contact">Deploy Unit</a>
      </nav>
      <main>
        <h1>Eagle x</h1>
        <p>We Engineer Dominance</p>
        <p>Forging high-performance digital infrastructure for the next generation of unicorn founders.</p>
        <p>RAPID DEPLOYMENT</p>
        <p>MVP in 7 Days</p>
        <p>Deploy Unit</p>
        ${body}
      </main>
    </body>
  </html>
`

const buildCurrentAboutPageHtml = ({
  body = '',
} = {}) => `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Eagle X | We Engineer Dominance</title>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/work">Our Work</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </nav>
      <main>
        <p>SYSTEM_OVERRIDE // 0 %</p>
        <h1>System Identity // Eagle X</h1>
        <h2>The Architects Of The New Order</h2>
        <p>We are not just a dev shop.</p>
        <p>We are a high-performance engineering unit dedicated to building digital dominance.</p>
        <p>While others follow trends, we forge the infrastructure that defines them.</p>
        <p>50+ // Projects Deployed</p>
        <p>08+ // Global Partners</p>
        <p>24/7 // System Monitor</p>
        <p>The Operatives</p>
        ${body}
      </main>
    </body>
  </html>
`

const buildCurrentContactPageHtml = ({
  body = '',
} = {}) => `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Eagle X | We Engineer Dominance</title>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/work">Our Work</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </nav>
      <main>
        <p>SYSTEM_OVERRIDE // 0 %</p>
        <p>// Get In Touch</p>
        <h1>Contact Us</h1>
        <p>We'd love to hear from you.</p>
        <p>Send us a message and we'll get back to you within 24 hours.</p>
        <p>Delhi, India</p>
        <p>Support Team</p>
        <p>Send Message</p>
        <p>Building professional web solutions for early-stage startups.</p>
        <p>Part of our 2026 launch initiative supporting the entrepreneurial ecosystem.</p>
        <p>Email Us eaglexdevelopment@gmail.com</p>
        <p>Location Indore, Madhya Pradesh, India</p>
        ${body}
      </main>
    </body>
  </html>
`

const buildMissingCareersRouteHtml = () => `
  ${buildCurrentOfficialPageHtml({
    body: `
      <title>404: This page could not be found.</title>
      <div>This page could not be found.</div>
    `,
  })}
`

const buildCurrentMissingCareersRouteHtml = () => `
  <!doctype html>
  <html lang="en">
    <head>
      <title>404: This page could not be found.</title>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/work">Our Work</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </nav>
      <main>
        <p>SYSTEM_OVERRIDE // 0 %</p>
        <h1>404</h1>
        <p>This page could not be found.</p>
        <p>Building professional web solutions for early-stage startups.</p>
        <p>Part of our 2026 launch initiative supporting the entrepreneurial ecosystem.</p>
        <p>Email Us eaglexdevelopment@gmail.com</p>
        <p>Location Indore, Madhya Pradesh, India</p>
      </main>
    </body>
  </html>
`

test('exports the verified first-party surface metadata for Eaglex SAS Makers Pvt Ltd', () => {
  assert.equal(SOURCE, 'eaglexsasmakerspvtltd')
  assert.equal(COMPANY, 'Eaglex SAS Makers Pvt Ltd')
  assert.equal(VERIFIED_AT, '2026-08-13')
  assert.equal(HOMEPAGE_URL, 'https://eaglex.co.in/')
  assert.equal(ABOUT_URL, 'https://eagle-x.in/about')
  assert.equal(CONTACT_URL, 'https://eagle-x.in/contact')
  assert.deepEqual(CAREERS_ROUTE_URLS, [
    'https://eagle-x.in/careers',
    'https://eagle-x.in/careers/',
    'https://eagle-x.in/jobs',
    'https://eagle-x.in/jobs/',
    'https://eagle-x.in/work-with-us',
    'https://eagle-x.in/work-with-us/',
  ])
})

test('distinguishes the verified marketing surface from a public jobs surface', () => {
  assert.equal(hasOfficialHomepageSignal(buildOfficialPageHtml()), true)
  assert.equal(hasOfficialHomepageSignal(buildCurrentOfficialPageHtml()), true)
  assert.equal(hasOfficialAboutPageSignal(buildCurrentAboutPageHtml()), true)
  assert.equal(hasOfficialContactPageSignal(buildCurrentContactPageHtml()), true)
  assert.equal(hasPublicJobsSignal(buildOfficialPageHtml()), false)
  assert.equal(hasPublicJobsSignal(buildCurrentOfficialPageHtml()), false)
  assert.equal(
    hasPublicJobsSignal(`
      <html>
        <body>
          <h1>Open Positions</h1>
          <script type="application/ld+json">{"@type":"JobPosting"}</script>
        </body>
      </html>
    `),
    true,
  )
})

test('recognizes the verified missing careers routes', () => {
  assert.equal(
    isVerifiedMissingCareersRoute({
      status: 200,
      html: buildMissingCareersRouteHtml(),
    }),
    true,
  )

  assert.equal(
    isVerifiedMissingCareersRoute({
      status: 404,
      html: buildCurrentMissingCareersRouteHtml(),
    }),
    true,
  )

  assert.equal(
    isVerifiedMissingCareersRoute({
      status: 200,
      html: buildOfficialPageHtml({
        body: '<h2>Current Openings</h2><p>Join our team</p>',
      }),
    }),
    false,
  )
})

test('run returns [] only while the verified first-party marketing surface and missing careers routes still match', async () => {
  const responses = new Map([
    [HOMEPAGE_URL, { status: 200, html: buildCurrentOfficialPageHtml() }],
    [ABOUT_URL, { status: 200, html: buildCurrentAboutPageHtml() }],
    [CONTACT_URL, { status: 200, html: buildCurrentContactPageHtml() }],
    ...CAREERS_ROUTE_URLS.map((url) => [url, { status: 404, html: buildCurrentMissingCareersRouteHtml() }]),
  ])

  const scraper = createEaglexSasMakersScraper()
  const jobs = await scraper.run({
    fetchPage: async (url) => {
      const response = responses.get(url)
      assert.ok(response, `Unexpected URL: ${url}`)
      return { ...response, url }
    },
  })

  assert.deepEqual(jobs, [])
})

test('run still accepts the legacy verified marketing surface and soft-404 careers routes', async () => {
  const responses = new Map([
    [HOMEPAGE_URL, { status: 200, html: buildOfficialPageHtml() }],
    [ABOUT_URL, { status: 200, html: buildOfficialPageHtml({ body: '<h2>About</h2>' }) }],
    [CONTACT_URL, { status: 200, html: buildOfficialPageHtml({ body: '<h2>Contact</h2>' }) }],
    ...CAREERS_ROUTE_URLS.map((url) => [url, { status: 200, html: buildMissingCareersRouteHtml() }]),
  ])

  const scraper = createEaglexSasMakersScraper()
  const jobs = await scraper.run({
    fetchPage: async (url) => {
      const response = responses.get(url)
      assert.ok(response, `Unexpected URL: ${url}`)
      return { ...response, url }
    },
  })

  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified surface starts exposing a public jobs board', async () => {
  const scraper = createEaglexSasMakersScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === 'https://eagle-x.in/jobs') {
          return {
            status: 200,
            url,
            html: buildOfficialPageHtml({
              body: '<h2>Current Openings</h2><script type="application/ld+json">{"@type":"JobPosting"}</script>',
            }),
          }
        }

        if (url === HOMEPAGE_URL || url === ABOUT_URL || url === CONTACT_URL) {
          return { status: 200, url, html: buildOfficialPageHtml() }
        }

        return { status: 200, url, html: buildMissingCareersRouteHtml() }
      },
    }),
    /public careers surface/i,
  )
})

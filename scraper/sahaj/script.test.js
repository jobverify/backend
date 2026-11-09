import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_PAGE_URL,
  HOMEPAGE_URL,
  JOB_ROLE_URL,
  JOIN_US_URL,
  createSahajScraper,
  extractHomepageJoinUsUrl,
  hasOfficialAboutPageSignal,
  hasOfficialHomepageSignal,
  hasOfficialJobRoleSignal,
  hasOfficialJoinUsSignal,
  hasPublicCompanyJobsSignal,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Sahaj Retail Limited | India's Largest Rural Digital &amp; Financial Services Network - Sahaj</title>
    </head>
    <body>
      <a href="/web/guest/joinuspage">Get Started</a>
      <h2>Why partner with Sahaj?</h2>
      <p>Sahaj Mitr (Retailer)</p>
      <p>support@sahaj.co.in</p>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <body>
      <h1>About Sahaj</h1>
      <h2>About Us</h2>
      <p>Sahaj Retail Limited, has delved into bridging the digital divide.</p>
      <h3>Core Values</h3>
      <h2>Meet Our <span>Leadership</span></h2>
    </body>
  </html>
`

const joinUsHtml = `
  <html>
    <head>
      <title>Become a Sahaj Mitr | Join Sahaj Retail Limited</title>
    </head>
    <body>
      <h1>Applicant Registration</h1>
      <p>Mobile Number with OTP Verification</p>
      <p>Valid PAN Card (Linked with Aadhaar)</p>
      <h2>Why partner with Sahaj</h2>
      <p>Sahaj Mitr</p>
    </body>
  </html>
`

const jobRoleHtml = `
  <html>
    <head>
      <title>Job Role page</title>
    </head>
    <body>
      <p>Sahaj has tie ups with the organization those required skilled &amp; unskilled manpower.</p>
      <p>Presently 30 job roles are on the portal under jobs tab like Driver, Electrician, Plumber &amp; Security Guard.</p>
      <p>You can registered yourself on the job role.</p>
    </body>
  </html>
`

const publicJobsHtml = `
  <html>
    <head>
      <title>Sahaj Retail Limited | India's Largest Rural Digital &amp; Financial Services Network - Sahaj</title>
    </head>
    <body>
      <a href="/web/guest/joinuspage">Get Started</a>
      <h2>Why partner with Sahaj?</h2>
      <p>Sahaj Mitr (Retailer)</p>
      <p>support@sahaj.co.in</p>
      <h1>Current Openings</h1>
      <a href="/careers/sales-associate">Apply Now</a>
    </body>
  </html>
`

test('Sahaj validators accept the current retail homepage and partner-registration markup', () => {
  assert.equal(
    extractHomepageJoinUsUrl(homepageHtml, HOMEPAGE_URL),
    'https://www.sahaj.co.in/web/guest/joinuspage',
  )
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialAboutPageSignal(aboutHtml), true)
  assert.equal(hasOfficialJoinUsSignal(joinUsHtml), true)
  assert.equal(hasOfficialJobRoleSignal(jobRoleHtml), true)
  assert.equal(hasPublicCompanyJobsSignal(homepageHtml), false)
  assert.equal(hasPublicCompanyJobsSignal(publicJobsHtml), true)
})

test('Sahaj returns an empty list when the verified retail surfaces remain non-listing partner flows', async () => {
  const scraper = createSahajScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === ABOUT_PAGE_URL) return { status: 200, url, html: aboutHtml }
      if (url === JOIN_US_URL) return { status: 200, url, html: joinUsHtml }
      if (url === JOB_ROLE_URL) return { status: 200, url, html: jobRoleHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Sahaj fails closed if any verified surface starts exposing public jobs', async () => {
  const scraper = createSahajScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, html: publicJobsHtml }
        if (url === ABOUT_PAGE_URL) return { status: 200, url, html: aboutHtml }
        if (url === JOIN_US_URL) return { status: 200, url, html: joinUsHtml }
        if (url === JOB_ROLE_URL) return { status: 200, url, html: jobRoleHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public company jobs/i,
  )
})

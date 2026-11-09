import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY_INFO_URL,
  LEARNING_HOME_URL,
  LEARNING_JOIN_US_URL,
  createSahajEVillageScraper,
  hasOfficialCompanyInfoSignal,
  hasOfficialLearningJoinUsSignal,
  hasPublicCompanyJobsSignal,
  isVerifiedGatewayTimeoutPage,
} from './script.js'

const companyInfoHtml = `
  <html>
    <body>
      <h1>AAJEEVIKA / SGSY Special Project</h1>
      <p>Implemented by: Sahaj e Village Ltd</p>
      <h2>About THE PIA</h2>
      <p>Sahaj e-Village Ltd, an ISO 27001 company</p>
      <p>registration Number 95455</p>
      <footer>Copyright 2012-2013 SeVL</footer>
    </body>
  </html>
`

const learningJoinUsHtml = `
  <html>
    <body>
      <h1>Why Join Sahaj eLearning Courses</h1>
      <p>Benefits of e Shiksha</p>
      <p>Sahaj Certificate</p>
      <p>NSDC Certificate</p>
      <p>Sahaj e Shiksha Course Fees</p>
      <footer>© Sahaj e-Village Limited</footer>
    </body>
  </html>
`

const gatewayTimeoutHtml = `
  <html>
    <head><title>504 Gateway Time-out</title></head>
    <body>
      <h1>504 Gateway Time-out</h1>
    </body>
  </html>
`

test('Sahaj e-Village validators still recognize the legacy info and learning pages', () => {
  assert.equal(hasOfficialCompanyInfoSignal(companyInfoHtml), true)
  assert.equal(hasOfficialLearningJoinUsSignal(learningJoinUsHtml), true)
  assert.equal(hasPublicCompanyJobsSignal(companyInfoHtml), false)
})

test('Sahaj e-Village recognizes the current first-party 504 outage shell', () => {
  assert.equal(isVerifiedGatewayTimeoutPage({
    status: 504,
    url: COMPANY_INFO_URL,
    html: gatewayTimeoutHtml,
  }), true)
  assert.equal(isVerifiedGatewayTimeoutPage({
    status: 504,
    url: LEARNING_JOIN_US_URL,
    html: gatewayTimeoutHtml,
  }), true)
  assert.equal(isVerifiedGatewayTimeoutPage({
    status: 504,
    url: LEARNING_HOME_URL,
    html: gatewayTimeoutHtml,
  }), true)
})

test('Sahaj e-Village returns an empty set when all verified first-party surfaces are consistently timing out', async () => {
  const scraper = createSahajEVillageScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => ({
      status: 504,
      url,
      html: gatewayTimeoutHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Sahaj e-Village still returns an empty set when the verified legacy surfaces are up and expose no public jobs', async () => {
  const scraper = createSahajEVillageScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      if (url === COMPANY_INFO_URL) return { status: 200, url, html: companyInfoHtml }
      if (url === LEARNING_JOIN_US_URL) return { status: 200, url, html: learningJoinUsHtml }
      if (url === LEARNING_HOME_URL) return { status: 200, url, html: learningJoinUsHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

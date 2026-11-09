import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createShopUpScraper,
  extractPublicRoleLinks,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
  hasVerifiedNonIndiaRoleSignal,
} from './script.js'

const homepageHtml = `
  <html>
    <body>
      <h1>Small Businesses,</h1>
      <h1>Big Impact!</h1>
      <p>Embedding commerce, logistics and financing solutions together to supercharge small businesses.</p>
      <p>ShopUp facilitates easy access to food and essentials for millions of people.</p>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <body>
      <h1>We are building tomorrow, join us today.</h1>
      <h2>See open roles</h2>
      <p>No available open positions at the moment</p>
    </body>
  </html>
`

const publicJobsHtml = `
  <html>
    <body>
      <h1>Current Openings</h1>
      <a href="/apply">Apply now</a>
    </body>
  </html>
`

const currentCareersHtml = `
  <html>
    <head><title>ShopUp Careers</title></head>
    <body>
      <h1>We are building tomorrow, join us today.</h1>
      <h2>See open roles</h2>
      <a href="/job-postings/key-account-manager">Key Account Manager</a>
      <a href="https://shopup.org/job-postings/sales-performance-executive">Sales Performance Executive</a>
      <footer>hello@shopup.org · 429–432, Tejgaon I/A, Dhaka 1208, Bangladesh</footer>
    </body>
  </html>
`

const bangladeshRoleHtml = `
  <html>
    <head><title>Key Account Manager | ShopUp</title></head>
    <body>
      <h1>Key Account Manager</h1>
      <p>ShopUp HQ (Tejgaon)</p>
      <h4>Job description</h4>
      <footer>429–432, Tejgaon I/A, Dhaka 1208, Bangladesh · hello@shopup.org</footer>
    </body>
  </html>
`

test('ShopUp sentinel stays pinned to the official homepage and explicit empty careers page', () => {
  assert.equal(SOURCE, 'shopup')
  assert.equal(COMPANY, 'ShopUp')
  assert.equal(HOMEPAGE_URL, 'https://shopup.org/')
  assert.equal(CAREERS_URL, 'https://shopup.org/career')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasPublicJobsSignal(publicJobsHtml), true)
})

test('run returns an empty list when the official ShopUp careers page explicitly reports no open positions', async () => {
  const requestedUrls = []
  const scraper = createShopUpScraper()

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

      if (url === CAREERS_URL) {
        return {
          status: 200,
          url: CAREERS_URL,
          html: careersHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('run verifies current public role pages as non-India before returning no India jobs', async () => {
  assert.equal(hasOfficialCareersSignal(currentCareersHtml), true)
  assert.deepEqual(extractPublicRoleLinks(currentCareersHtml), [
    'https://shopup.org/job-postings/key-account-manager',
    'https://shopup.org/job-postings/sales-performance-executive',
  ])
  assert.equal(hasVerifiedNonIndiaRoleSignal(bangladeshRoleHtml), true)

  const requestedUrls = []
  const jobs = await createShopUpScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === CAREERS_URL) return { status: 200, url, html: currentCareersHtml }
      return { status: 200, url, html: bangladeshRoleHtml }
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    'https://shopup.org/job-postings/key-account-manager',
    'https://shopup.org/job-postings/sales-performance-executive',
  ])
  assert.deepEqual(jobs, [])
})

test('run rejects current role links whose country cannot be verified', async () => {
  await assert.rejects(
    createShopUpScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === CAREERS_URL) return { status: 200, url, html: currentCareersHtml }
        return { status: 200, url, html: '<html><body><h1>Key Account Manager</h1></body></html>' }
      },
    }),
    /country could not be verified/i,
  )
})

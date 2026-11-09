import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  DIRECT_JOB_ROUTE_URLS,
  HOMEPAGE_URL,
  VECV_CAREERS_URL,
  createEicherTrucksScraper,
  hasOfficialCareersPageSignal,
  hasOfficialHomepageSignal,
  hasVecvCareerHandoffSignal,
  isBlockedVecvCareersRoute,
  isMissingDirectJobRoute,
} from './script.js'

const currentHomepageHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <title data-next-head="">Eicher Trucks and Buses : Best-in-Class Commercial Vehicles in India</title>
      <meta
        name="description"
        content="Explore Eicher Trucks and Buses, offering a wide range of commercial vehicles in India designed for performance, reliability, and efficiency across various industries."
      />
    </head>
    <body>
      <a href="/careers">Careers</a>
    </body>
  </html>
`

const careersPageHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <title data-next-head="">Careers - Eicher Trucks &amp; Buses</title>
    </head>
    <body>
      <h1>The Eicher Path to Progress</h1>
      <section>Join our Family</section>
      <aside>Beware Of Fake Job Offers</aside>
      <a href="https://careers.vecv.in/">Explore Opportunities</a>
      <p>Browse through the current openings</p>
    </body>
  </html>
`

const missingDirectRoutePage = {
  status: 404,
  url: 'https://www.eichertrucksandbuses.com/career',
  html: '<html><head><title>404</title></head><body>Page not found</body></html>',
}

const blockedVecvPage = {
  status: 403,
  url: 'https://careers.vecv.in/',
  html: '<html><head><title>Just a moment...</title></head><body>Access denied</body></html>',
}

test('Eicher Trucks recognizes the current homepage copy plus the VECV careers handoff surface', async () => {
  assert.equal(hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(hasVecvCareerHandoffSignal(careersPageHtml), true)
  assert.equal(hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(isMissingDirectJobRoute(missingDirectRoutePage), true)
  assert.equal(isBlockedVecvCareersRoute(blockedVecvPage), true)

  const requestedUrls = []
  const jobs = await createEicherTrucksScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: currentHomepageHtml }
      }
      if (url === CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }
      if (DIRECT_JOB_ROUTE_URLS.includes(url)) {
        return { ...missingDirectRoutePage, url }
      }
      if (url === VECV_CAREERS_URL) {
        return blockedVecvPage
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_PAGE_URL,
    ...DIRECT_JOB_ROUTE_URLS,
    VECV_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Eicher Trucks fails closed when the homepage loses the official careers handoff', async () => {
  await assert.rejects(
    createEicherTrucksScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Eicher Trucks and Buses : Best-in-Class Commercial Vehicles in India</title></head><body>No careers link</body></html>',
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )
})

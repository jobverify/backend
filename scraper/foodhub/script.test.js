import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_API_URL,
  CAREERS_PAGE_URL,
  CAREERS_PORTAL_URL,
  HOMEPAGE_URL,
  createFoodhubScraper,
  hasOfficialCareersPageSignal,
  hasOfficialHomepageSignal,
  hasOfficialPortalSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Foodhub - All orders at the lowest commission/service charge</title>
      <meta property="og:url" content="https://global.foodhub.com/" />
      <meta property="og:site_name" content="Foodhub" />
    </head>
    <body>
      <p>Foodhub - Order Eat Enjoy</p>
      <p>Lowest commission fees. Save with every order.</p>
      <a href="https://foodhubcareers.com">Careers</a>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Foodhub Careers | Work With Us, We Are Fun, Innovative & Successful</title>
    </head>
    <body>
      <p>Work With Us</p>
      <p>APPLY FOR JOBS</p>
      <p>View All Openings</p>
      <p>Why foodhub?</p>
      <p>Testimonials</p>
    </body>
  </html>
`

const portalHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Jobs at Foodhub</title>
      <meta property="og:url" content="https://jobs.foodhubcareers.com/jobs/Careers" />
    </head>
    <body>
      <input id="pageJson" />
      <input id="moduleMeta" />
      <input id="jobs" />
    </body>
  </html>
`

const jobsPayload = {
  code: 'success',
  data: [
    {
      id: '345994000212112184',
      Posting_Title: 'Lead Engineer',
      Department: 'Engineering',
      City: 'Bangalore',
      State: 'Karnataka',
      Country: 'India',
      $url: 'https://jobs.foodhubcareers.com/jobs/Careers/345994000212112184/Lead-Engineer?source=CareerSite',
      Job_Type: 'Full Time',
      Job_Description: 'Build scalable systems.',
      Publish: true,
    },
  ],
}

const detailPage = {
  status: 200,
  url: 'https://jobs.foodhubcareers.com/jobs/Careers/345994000212112184/Lead-Engineer?source=CareerSite',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <h1>Lead Engineer</h1>
        <p>Foodhub</p>
      </body>
    </html>
  `,
}

test('Foodhub accepts the current homepage and careers marketing shells', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(hasOfficialPortalSignal(portalHtml), true)
})

test('Foodhub run validates the current homepage, portal chain, and job detail route before returning jobs', async () => {
  const requestedPages = []
  const requestedJsonUrls = []

  const jobs = await createFoodhubScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)
      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === CAREERS_PAGE_URL) return { status: 200, url, html: careersHtml }
      if (url === CAREERS_PORTAL_URL) return { status: 200, url, html: portalHtml }
      if (url === detailPage.url) return detailPage
      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === CAREERS_API_URL) return jobsPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-08-02T05:00:00.000Z',
  })

  assert.deepEqual(requestedPages, [
    HOMEPAGE_URL,
    CAREERS_PAGE_URL,
    CAREERS_PORTAL_URL,
    detailPage.url,
  ])
  assert.deepEqual(requestedJsonUrls, [CAREERS_API_URL])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      location: jobs[0].location,
      link: jobs[0].link,
      source: jobs[0].source,
      scrapedAt: jobs[0].scrapedAt,
    },
    {
      title: 'Lead Engineer',
      location: 'Bangalore, Karnataka, India',
      link: detailPage.url,
      source: 'foodhub',
      scrapedAt: '2026-08-02T05:00:00.000Z',
    },
  )
})

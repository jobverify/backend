import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_CANDIDATE_PATHS,
  COMPANY,
  HOMEPAGE_URL,
  createEclipse360Scraper,
  hasOfficialHomepageSignal,
  pageExposesPublicJobListings,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Eclipse360 | Microsoft Dynamics 365 CRM Specialists</title>
      <meta
        name="description"
        content="Eclipse360 helps organizations deliver customer engagement and business process improvements with Microsoft Dynamics 365."
      />
    </head>
    <body>
      <header>
        <a href="/">Eclipse360</a>
        <nav>
          <a href="/services">Services</a>
          <a href="/about-us">About Us</a>
          <a href="/contact-us">Contact Us</a>
        </nav>
      </header>
      <main>
        <h1>Microsoft Dynamics 365 CRM Specialists</h1>
        <p>
          Eclipse360 designs, implements, and supports Microsoft Dynamics 365
          solutions for customer service, sales, and field operations teams.
        </p>
      </main>
    </body>
  </html>
`

const missingCareersHtml = `
  <html>
    <head>
      <title>404 | Eclipse360</title>
    </head>
    <body>
      <h1>Page not found</h1>
      <p>The page you requested could not be found.</p>
      <a href="/">Return to Eclipse360</a>
    </body>
  </html>
`

const currentHomepageHtml = `
  <html>
    <head>
      <title>Freelance Web Development in Leeds, West Yorkshire - eclipse360</title>
    </head>
    <body>
      <a href="./">homepage</a>
      <p>nick@eclipse360</p>
      <h1>eclipse360</h1>
      <p>freelance web &amp; media developer based in Leeds</p>
      <p>eclipse360 are a freelance web design and web development business based in Leeds, West Yorkshire.</p>
    </body>
  </html>
`

const plain404Html = `
  <html>
    <head>
      <title>404 Not Found</title>
    </head>
    <body>
      <h1>404 Not Found</h1>
      <p>Not Found</p>
      <p>The requested URL was not found on this server.</p>
    </body>
  </html>
`

const jobsPageHtml = `
  <html>
    <head>
      <title>Careers | Eclipse360</title>
    </head>
    <body>
      <h1>Careers</h1>
      <article class="job-listing">
        <h2>Dynamics 365 Consultant</h2>
        <a href="/careers/dynamics-365-consultant">Apply now</a>
      </article>
    </body>
  </html>
`

test('recognizes the verified Eclipse360 official homepage and no-listings pages', () => {
  assert.equal(COMPANY, 'Eclipse360')
  assert.equal(HOMEPAGE_URL, 'https://www.eclipse360.co.uk/')
  assert.deepEqual(CAREERS_CANDIDATE_PATHS, ['/careers', '/jobs', '/vacancies'])
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><title>Other Company</title></html>'), false)
  assert.equal(pageExposesPublicJobListings(missingCareersHtml), false)
  assert.equal(pageExposesPublicJobListings(plain404Html), false)
  assert.equal(pageExposesPublicJobListings(jobsPageHtml), true)
})

test('run returns [] only when the official Eclipse360 site shape is valid and candidate job pages show no public listings', async () => {
  const requestedUrls = []
  const scraper = createEclipse360Scraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === 'https://www.eclipse360.co.uk/') {
        return {
          ok: true,
          status: 200,
          url,
          text: currentHomepageHtml,
        }
      }

      return {
        ok: false,
        status: 404,
        url,
        text: plain404Html,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.eclipse360.co.uk/',
    'https://www.eclipse360.co.uk/careers',
    'https://www.eclipse360.co.uk/jobs',
    'https://www.eclipse360.co.uk/vacancies',
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the homepage no longer matches the verified official Eclipse360 site', async () => {
  await assert.rejects(
    createEclipse360Scraper().run({
      fetchPage: async () => ({
        ok: true,
        status: 200,
        url: 'https://www.eclipse360.co.uk/',
        text: '<html><title>Holding page</title><body>Welcome</body></html>',
      }),
    }),
    /official Eclipse360 website/i,
  )
})

test('run fails closed when a candidate public careers page begins exposing jobs', async () => {
  await assert.rejects(
    createEclipse360Scraper().run({
      fetchPage: async (url) => ({
        ok: true,
        status: 200,
        url,
        text: url === 'https://www.eclipse360.co.uk/' ? homepageHtml : jobsPageHtml,
      }),
    }),
    /public job listings/i,
  )
})

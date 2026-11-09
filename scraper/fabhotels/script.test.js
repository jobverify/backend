import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createFabHotelsScraper,
  extractRoleUrls,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>FabHotels: India&#x27;s Best Budget Hotels | Online Hotel Booking</title>
    </head>
    <body>
      <p>Book top-rated budget hotels in India.</p>
      <p>FabHotels across 76 cities</p>
      <footer>Travelstack Tech Limited</footer>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers @ FabHotels - FabHotels.com</title>
    </head>
    <body>
      <nav>
        <a href="/careers/department-all">All</a>
        <a href="/careers/department-technology">Technology</a>
        <a href="/careers/department-sales">Sales</a>
        <a href="/careers/department-revenue-and-pricing">Revenue And Pricing</a>
        <a href="/careers/department-design">Design</a>
      </nav>
      <section>
        <a href="/careers/FS-TECH-P1">Role 1</a>
        <a href="/careers/CS-B2B-P1">Role 2</a>
        <a href="/careers/BA-RP-P1">Role 3</a>
        <a href="/careers/TT-TA-P4">Role 4</a>
        <a href="/careers/UX-DD-P1">Role 5</a>
        <a href="/careers/TA-SA-P1">Role 6</a>
      </section>
    </body>
  </html>
`

const detailHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Career Details @ FabHotels.com - FabHotels.com</title>
    </head>
    <body>
      <h3>Frontend Engineer</h3>
      <p>Department: Technology</p>
      <p>Location: Gurgaon</p>
      <p>Relevant Experience: 3-5 years</p>
      <h4>Responsibilities</h4>
      <ul><li>Build products</li></ul>
      <p>If you have similar experience, send your CV to jobs@fabhotels.com</p>
      <button>Apply to this Job</button>
    </body>
  </html>
`

test('FabHotels homepage accepts the current encoded apostrophe title and ignores department filter links', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(extractRoleUrls(careersHtml), [
    'https://www.fabhotels.com/careers/FS-TECH-P1',
    'https://www.fabhotels.com/careers/CS-B2B-P1',
    'https://www.fabhotels.com/careers/BA-RP-P1',
    'https://www.fabhotels.com/careers/TT-TA-P4',
    'https://www.fabhotels.com/careers/UX-DD-P1',
    'https://www.fabhotels.com/careers/TA-SA-P1',
  ])
})

test('FabHotels scraper returns the verified first-party roles', async () => {
  const requestedUrls = []
  const jobs = await createFabHotelsScraper({
    maxJobs: 1,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      if (url === 'https://www.fabhotels.com/careers/FS-TECH-P1') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    'https://www.fabhotels.com/careers/FS-TECH-P1',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Frontend Engineer')
  assert.equal(jobs[0].source, 'fabhotels')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})

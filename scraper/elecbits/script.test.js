import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createElecbitsScraper,
  extractPublicListings,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Electronics Manufacturing and Supply Chain Solutions Elecbits</title>
    </head>
    <body>
      <a href="https://elecbits.in/careers/">Careers</a>
      <p>Elecbits is your Full-Stack Electronics Partner</p>
      <footer>Azoox Technologies Private Limited</footer>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at Elecbits Join Electronics Innovation Team</title>
    </head>
    <body>
      <section>
        <h2>Shape India's future with hardware.</h2>
        <h3>Join the Team</h3>
      </section>
      <div class="desktop-cards">
        <section class="role-card">
          <h3>Team Lead - Sales</h3>
          <span>Bangalore/Gurugram</span>
          <a href="https://elecbits.in/elecbits-jd-sales/">See details</a>
        </section>
        <section class="role-card">
          <h3>Sr. Project Manager</h3>
          <span>Bangalore, Karnataka</span>
          <a href="https://elecbits.in/elecbits-jd-senior-project-manager/">See details</a>
        </section>
        <section class="role-card">
          <h3>Sr. Firmware Engineer</h3>
          <span>Bangalore, Karnataka</span>
          <a href="https://elecbits.in/elecbits-jd-senior-firmware-engineer/">See details</a>
        </section>
        <section class="role-card">
          <h3>Sr. Hardware Engineer</h3>
          <span>Bangalore, Karnataka</span>
          <a href="https://elecbits.in/elecbits-jd-senior-hardware-engineer/">See details</a>
        </section>
      </div>
      <div class="mobile-slider">
        <section class="role-card">
          <h3>Senior Firmware Engineer</h3>
          <a href="#">See details</a>
        </section>
      </div>
    </body>
  </html>
`

test('extractPublicListings parses the verified Elecbits role cards and ignores mobile duplicates', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)

  const jobs = extractPublicListings(careersHtml)
  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Team Lead - Sales',
        location: 'Bangalore/Gurugram',
        sourceUrl: 'https://elecbits.in/elecbits-jd-sales/',
        applyUrl: null,
      },
      {
        title: 'Sr. Project Manager',
        location: 'Bangalore, Karnataka',
        sourceUrl: 'https://elecbits.in/elecbits-jd-senior-project-manager/',
        applyUrl: null,
      },
      {
        title: 'Sr. Firmware Engineer',
        location: 'Bangalore, Karnataka',
        sourceUrl: 'https://elecbits.in/elecbits-jd-senior-firmware-engineer/',
        applyUrl: null,
      },
      {
        title: 'Sr. Hardware Engineer',
        location: 'Bangalore, Karnataka',
        sourceUrl: 'https://elecbits.in/elecbits-jd-senior-hardware-engineer/',
        applyUrl: null,
      },
    ],
  )
})

test('scraper run fetches the official homepage and careers page and returns normalized jobs', async () => {
  const requestedUrls = []
  const scraper = createElecbitsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].company, 'Elecbits')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'elecbits')
  assert.equal(jobs[0].link, 'https://elecbits.in/elecbits-jd-sales/')
  assert.ok(jobs[0].scrapedAt)
})

test('fails closed when the Elecbits homepage signal changes', async () => {
  await assert.rejects(
    createElecbitsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><body>No careers link</body></html>'
        return careersHtml
      },
    }),
    /Elecbits homepage no longer matches the verified official public site/i,
  )
})

test('fails closed when the Elecbits careers surface changes', async () => {
  await assert.rejects(
    createElecbitsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return '<html><head><title>Careers at Elecbits Join Electronics Innovation Team</title></head><body>No role cards</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Elecbits careers page no longer matches the verified official public jobs surface/i,
  )
})

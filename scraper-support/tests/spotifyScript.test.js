import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY,
  createSpotifyScraper,
  FAQ_PAGE_URL,
  hasFaqLegitimacySignal,
  hasJobsPageSignal,
  hasLocationsPageSignal,
  hasMumbaiZeroJobsSignal,
  JOBS_PAGE_URL,
  LOCATIONS_PAGE_URL,
  MUMBAI_LOCATION_PAGE_URL,
  SOURCE,
} from '../../scraper/spotify/script.js'

const jobsPageHtml = `
  <html>
    <body>
      <h1>All Jobs</h1>
      <p>Latest</p>
      <label>Location</label>
      <label>Category</label>
      <label>Job type</label>
      <a href="/start-your-journey">Read our FAQ</a>
      <footer>© 2026 Spotify AB.</footer>
    </body>
  </html>
`

const locationsPageHtml = `
  <html>
    <body>
      <h1>Rock our world?</h1>
      <section>Asia Pacific</section>
      <ul>
        <li>Mumbai</li>
        <li>Bangalore</li>
      </ul>
    </body>
  </html>
`

const mumbaiPageHtml = `
  <html>
    <body>
      <h1>Hello Mumbai!</h1>
      <p>We launched in India in 2019, and today we're the most-loved audio-streaming platform in the country.</p>
      <p>We're based in the Bandra Kurla Complex, in the corporate hub of Mumbai.</p>
      <p>0 jobs in all categories in all job types</p>
    </body>
  </html>
`

const faqPageHtml = `
  <html>
    <body>
      <h2>How do I know if a Spotify email or website is legit?</h2>
      <p>The URL for the Spotify Careers Site is www.lifeatspotify.com and the link for a full-time role at Spotify will begin with https://lifeatspotify.com/jobs or https://jobs.lever.co/spotify.</p>
    </body>
  </html>
`

test('Spotify scraper constants stay pinned to the verified first-party careers surfaces', () => {
  assert.equal(SOURCE, 'spotify')
  assert.equal(COMPANY, 'Spotify')
  assert.equal(JOBS_PAGE_URL, 'https://www.lifeatspotify.com/jobs')
  assert.equal(LOCATIONS_PAGE_URL, 'https://www.lifeatspotify.com/find-your-team/locations')
  assert.equal(MUMBAI_LOCATION_PAGE_URL, 'https://www.lifeatspotify.com/find-your-team/locations/mumbai')
  assert.equal(FAQ_PAGE_URL, 'https://www.lifeatspotify.com/start-your-journey')
  assert.equal(hasJobsPageSignal(jobsPageHtml), true)
  assert.equal(hasLocationsPageSignal(locationsPageHtml), true)
  assert.equal(hasMumbaiZeroJobsSignal(mumbaiPageHtml), true)
  assert.equal(hasFaqLegitimacySignal(faqPageHtml), true)
})

test('Spotify returns no jobs only while the verified first-party India surfaces remain zero-openings pages', async () => {
  const requestedUrls = []
  const jobs = await createSpotifyScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === JOBS_PAGE_URL) {
        return { status: 200, url, html: jobsPageHtml }
      }

      if (url === LOCATIONS_PAGE_URL) {
        return { status: 200, url, html: locationsPageHtml }
      }

      if (url === MUMBAI_LOCATION_PAGE_URL) {
        return { status: 200, url, html: mumbaiPageHtml }
      }

      if (url === FAQ_PAGE_URL) {
        return { status: 200, url, html: faqPageHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    JOBS_PAGE_URL,
    LOCATIONS_PAGE_URL,
    MUMBAI_LOCATION_PAGE_URL,
    FAQ_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Spotify fails closed when any verified first-party page drifts', async () => {
  await assert.rejects(
    createSpotifyScraper().run({
      fetchPage: async (url) => {
        if (url === JOBS_PAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        return { status: 200, url, html: jobsPageHtml }
      },
    }),
    /first-party jobs page/i,
  )

  await assert.rejects(
    createSpotifyScraper().run({
      fetchPage: async (url) => {
        if (url === JOBS_PAGE_URL) {
          return { status: 200, url, html: jobsPageHtml }
        }

        if (url === LOCATIONS_PAGE_URL) {
          return { status: 200, url, html: '<html><body>No Asia Pacific offices</body></html>' }
        }

        return { status: 200, url, html: jobsPageHtml }
      },
    }),
    /first-party locations page/i,
  )

  await assert.rejects(
    createSpotifyScraper().run({
      fetchPage: async (url) => {
        if (url === JOBS_PAGE_URL) {
          return { status: 200, url, html: jobsPageHtml }
        }

        if (url === LOCATIONS_PAGE_URL) {
          return { status: 200, url, html: locationsPageHtml }
        }

        if (url === MUMBAI_LOCATION_PAGE_URL) {
          return { status: 200, url, html: '<html><body>Hello Mumbai! 2 jobs now open.</body></html>' }
        }

        return { status: 200, url, html: jobsPageHtml }
      },
    }),
    /Mumbai first-party zero-jobs page/i,
  )
})

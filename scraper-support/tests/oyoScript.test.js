import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <p>OYO for Business</p>
    <p>Trusted by 5000 Corporates</p>
    <p>List your property</p>
    <h1>Over 174,000+ hotels and homes across 35+ countries</h1>
    <footer>
      <a href="https://www.oyorooms.com/about/">About Us</a>
      <a href="https://www.linkedin.com/company/oyo-rooms/jobs/">Teams / Careers</a>
      <a href="https://www.oyorooms.com/blog/">Blogs</a>
    </footer>
    <p>2013-2022 © Oravel Stays Limited</p>
  </body>
</html>
`

const LOCALIZED_CONSUMER_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <p>OYO for Business</p>
    <p>List your property</p>
    <h1>From Stays to Experiences — Your Trusted Hotel Partner</h1>
    <p>Search</p>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Positions</h1>
    <a href="https://jobs.example.com/revenue-manager">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/oyo/script.js')
  } catch {
    assert.fail('Expected OYO scraper module at ../../scraper/oyo/script.js')
  }
}

test('OYO sentinel helpers stay pinned to the official homepage careers handoff and non-jobs careers route', async () => {
  const oyo = await loadModule()

  assert.equal(oyo.COMPANY, 'OYO')
  assert.equal(oyo.OFFICIAL_BRAND_NAME, 'OYO')
  assert.equal(oyo.VERIFIED_ON, '2026-07-17')
  assert.equal(oyo.HOMEPAGE_URL, 'https://www.oyorooms.com/')
  assert.equal(oyo.CAREERS_PAGE_URL, 'https://www.oyorooms.com/careers')
  assert.equal(oyo.LINKEDIN_CAREERS_URL, 'https://www.linkedin.com/company/oyo-rooms/jobs/')
  assert.equal(oyo.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(
    oyo.extractVerifiedLinkedInCareersUrl(HOMEPAGE_HTML),
    'https://www.linkedin.com/company/oyo-rooms/jobs/',
  )
  assert.equal(oyo.hasConsumerBookingSurfaceSignal(HOMEPAGE_HTML), true)
  assert.equal(oyo.hasConsumerBookingSurfaceSignal(LOCALIZED_CONSUMER_HTML), true)
  assert.equal(oyo.pageExposesPublicJobListings(HOMEPAGE_HTML), false)
  assert.equal(oyo.pageExposesPublicJobListings(LOCALIZED_CONSUMER_HTML), false)
  assert.equal(oyo.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    oyo.isAcceptedCareersRedirect('https://www.oyorooms.com/id/', LOCALIZED_CONSUMER_HTML),
    true,
  )
})

test('OYO returns [] when the official homepage only hands careers traffic to LinkedIn and /careers resolves to a consumer page', async () => {
  const oyo = await loadModule()
  const requestedUrls = []

  const jobs = await oyo.createOyoScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === oyo.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === oyo.CAREERS_PAGE_URL) {
        return { status: 200, url: oyo.HOMEPAGE_URL, html: HOMEPAGE_HTML }
      }

      throw new Error(`Unexpected OYO URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    oyo.HOMEPAGE_URL,
    oyo.CAREERS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('OYO also returns [] when /careers resolves to a localized consumer booking surface instead of a jobs board', async () => {
  const oyo = await loadModule()

  const jobs = await oyo.createOyoScraper().run({
    fetchPage: async (url) => {
      if (url === oyo.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === oyo.CAREERS_PAGE_URL) {
        return { status: 200, url: 'https://www.oyorooms.com/id/', html: LOCALIZED_CONSUMER_HTML }
      }

      throw new Error(`Unexpected OYO URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('OYO fails closed when the verified homepage link or /careers route changes into a real jobs surface', async () => {
  const oyo = await loadModule()

  await assert.rejects(
    oyo.createOyoScraper().run({
      fetchPage: async (url) => {
        if (url === oyo.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected OYO URL: ${url}`)
      },
    }),
    /verified official oyo homepage/i,
  )

  await assert.rejects(
    oyo.createOyoScraper().run({
      fetchPage: async (url) => {
        if (url === oyo.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: HOMEPAGE_HTML.replace(
              'https://www.linkedin.com/company/oyo-rooms/jobs/',
              'https://www.oyorooms.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected OYO URL: ${url}`)
      },
    }),
    /verified oyo careers handoff/i,
  )

  await assert.rejects(
    oyo.createOyoScraper().run({
      fetchPage: async (url) => {
        if (url === oyo.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === oyo.CAREERS_PAGE_URL) {
          return { status: 200, url: 'https://www.oyorooms.com/jobs', html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected OYO URL: ${url}`)
      },
    }),
    /verified oyo exact-name careers route changed materially|careers route now appears to expose public jobs/i,
  )
})

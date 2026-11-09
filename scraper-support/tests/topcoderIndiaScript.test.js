import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home | Topcoder</title>
  </head>
  <body>
    <main>
      <h1>Fueling Innovation, Delivery, and the Future of Work</h1>
      <p>Topcoder is the single platform powering scalable human + AI talent, rapid execution, and crowd-driven innovation.</p>
      <a href="https://www.topcoder.com/community/tcgigs">Gig Work</a>
    </main>
  </body>
</html>
`

const GIG_LANDING_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gigs at Topcoder | Topcoder</title>
  </head>
  <body>
    <main>
      <h1>Welcome to Gig Work at Topcoder</h1>
      <p>There are many ways to live the freelance, Topcoder lifestyle, but if you’re after a steady income and a traditional workweek, our freelance gigs are the way to go.</p>
      <p>Our Gig Work opportunities are open to folks around the world as location does not matter.</p>
      <p>We also really need folks in the USA and India.</p>
      <p>General Intake of Gig Work form</p>
    </main>
  </body>
</html>
`

const GIG_PROGRAM_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gig Work | Topcoder</title>
  </head>
  <body>
    <main>
      <h1>GIG WORK</h1>
      <p>Looking for a full time gig or guaranteed income? Find it at Topcoder.</p>
      <p>Gig Work is a full time, freelance position working directly with our customers.</p>
      <p>Being a Topcoder member is the first thing you need to do to get a Gig Work opportunity.</p>
      <p>We have many Gig Work opportunities that you may be interested in and more are being posted daily.</p>
    </main>
  </body>
</html>
`

const GIG_RESOURCES_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gig Work Resources | Topcoder</title>
  </head>
  <body>
    <main>
      <h1>Gig Work Update</h1>
      <h2>Transfer of Gig Work</h2>
      <p>The management of Topcoder gigs is being transferred to Wipro, Topcoder’s parent company, as of February 1, 2024.</p>
      <p>Please direct your queries to talent.topcoder@wipro.com for the quickest response.</p>
      <p>Yes, gigs will still be available for you to apply to.</p>
    </main>
  </body>
</html>
`

const EXACT_NAME_EMPLOYER_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Topcoder India Careers</h1>
      <article>
        <h2>Software Engineer</h2>
        <p>Company: Topcoder India</p>
        <a href="https://www.topcoder.com/careers/topcoder-india-software-engineer">Apply now</a>
      </article>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/topcoderindia/script.js')
  } catch {
    assert.fail('Expected Topcoder India scraper module at ../../scraper/topcoderindia/script.js')
  }
}

test('Topcoder India sentinel helpers stay pinned to the verified first-party gig marketplace surfaces', async () => {
  const topcoderIndia = await loadModule()

  assert.equal(topcoderIndia.SOURCE, 'topcoderindia')
  assert.equal(topcoderIndia.COMPANY, 'Topcoder India')
  assert.equal(topcoderIndia.OFFICIAL_BRAND_NAME, 'Topcoder')
  assert.equal(topcoderIndia.HOMEPAGE_URL, 'https://www.topcoder.com/')
  assert.equal(topcoderIndia.CAREERS_URL, 'https://www.topcoder.com/community/tcgigs')
  assert.equal(
    topcoderIndia.GIG_PROGRAM_URL,
    'https://www.topcoder.com/community/member-programs/gigs',
  )
  assert.equal(
    topcoderIndia.GIG_RESOURCES_URL,
    'https://www.topcoder.com/community/gig-resources',
  )
  assert.equal(topcoderIndia.VERIFIED_ON, '2026-07-17')
  assert.equal(topcoderIndia.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(topcoderIndia.hasGigWorkLandingSignal(GIG_LANDING_HTML), true)
  assert.equal(topcoderIndia.hasGigProgramSignal(GIG_PROGRAM_HTML), true)
  assert.equal(topcoderIndia.hasGigTransferSignal(GIG_RESOURCES_HTML), true)
  assert.equal(topcoderIndia.pageExposesExactNameEmployerJobs(EXACT_NAME_EMPLOYER_JOBS_HTML), true)
  assert.equal(topcoderIndia.pageExposesExactNameEmployerJobs(GIG_LANDING_HTML), false)
})

test('Topcoder India returns [] only while the verified first-party surfaces remain a gig marketplace rather than an exact-name employer feed', async () => {
  const topcoderIndia = await loadModule()
  const requestedUrls = []

  const jobs = await topcoderIndia.createTopcoderIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === topcoderIndia.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }
      if (url === topcoderIndia.CAREERS_URL) {
        return { status: 200, url, html: GIG_LANDING_HTML }
      }
      if (url === topcoderIndia.GIG_PROGRAM_URL) {
        return { status: 200, url, html: GIG_PROGRAM_HTML }
      }
      if (url === topcoderIndia.GIG_RESOURCES_URL) {
        return { status: 200, url, html: GIG_RESOURCES_HTML }
      }

      throw new Error(`Unexpected Topcoder India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    topcoderIndia.HOMEPAGE_URL,
    topcoderIndia.CAREERS_URL,
    topcoderIndia.GIG_PROGRAM_URL,
    topcoderIndia.GIG_RESOURCES_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Topcoder India fails closed when the verified gig marketplace changes or exact-name employer jobs appear', async () => {
  const topcoderIndia = await loadModule()

  await assert.rejects(
    topcoderIndia.createTopcoderIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === topcoderIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected Topcoder India URL: ${url}`)
      },
    }),
    /verified first-party homepage changed materially/i,
  )

  await assert.rejects(
    topcoderIndia.createTopcoderIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === topcoderIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }
        if (url === topcoderIndia.CAREERS_URL) {
          return { status: 200, url, html: EXACT_NAME_EMPLOYER_JOBS_HTML }
        }
        if (url === topcoderIndia.GIG_PROGRAM_URL) {
          return { status: 200, url, html: GIG_PROGRAM_HTML }
        }
        if (url === topcoderIndia.GIG_RESOURCES_URL) {
          return { status: 200, url, html: GIG_RESOURCES_HTML }
        }

        throw new Error(`Unexpected Topcoder India URL: ${url}`)
      },
    }),
    /exact-name employer jobs/i,
  )

  await assert.rejects(
    topcoderIndia.createTopcoderIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === topcoderIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }
        if (url === topcoderIndia.CAREERS_URL) {
          return { status: 200, url, html: GIG_LANDING_HTML }
        }
        if (url === topcoderIndia.GIG_PROGRAM_URL) {
          return { status: 200, url, html: '<html><body><h1>Different page</h1></body></html>' }
        }
        if (url === topcoderIndia.GIG_RESOURCES_URL) {
          return { status: 200, url, html: GIG_RESOURCES_HTML }
        }

        throw new Error(`Unexpected Topcoder India URL: ${url}`)
      },
    }),
    /verified gig program page changed materially/i,
  )
})

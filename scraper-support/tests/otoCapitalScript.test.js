import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Buy Bikes, Scooters, Electric Scooters In India - OTO</title>
    <meta
      name="description"
      content="India's most trusted place to buy bikes, scooters and electric scooters of all brands on loan and in cash. Digital Process. Lowest EMIs. Fast Deliveries - OTO"
    />
    <link rel="canonical" href="https://www.otocapital.in" />
  </head>
  <body>
    <h1>India&#x27;s No 1 platform for Bike &amp; Scooter Loans</h1>
    <section>
      <h2>FREQUENTLY ASKED QUESTIONS</h2>
      <h3>What is OTO?</h3>
      <p>OTO Capital also provides other industry first and only features like test ride at customer location and home delivery of two-wheelers.</p>
      <p>OTO provides its services in 22+ cities across India.</p>
    </section>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.otocapital.in/</loc></url>
  <url><loc>https://www.otocapital.in/grievance-portal</loc></url>
  <url><loc>https://www.otocapital.in/lending-partners</loc></url>
  <url><loc>https://www.otocapital.in/faq</loc></url>
</urlset>
`

const sitemapWithCareers = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.otocapital.in/</loc></url>
  <url><loc>https://www.otocapital.in/careers</loc></url>
</urlset>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title data-rh="true">OTO Capital - Not Found</title>
  </head>
  <body>
    <p>Visit OTO Capital</p>
    <p>Explore new bikes</p>
    <p>Explore bike plans</p>
  </body>
</html>
`

const jobsHtml = `
<html>
  <body>
    <h1>Backend Engineer</h1>
    <a href="https://jobs.lever.co/oto-capital/backend-engineer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/otocapital/script.js')
  } catch {
    assert.fail('Expected OTO Capital scraper module at ../../scraper/otocapital/script.js')
  }
}

test('OTO Capital sentinel pins the verified homepage, sitemap, and not-found careers contract', async () => {
  const otoCapital = await loadModule()

  assert.equal(otoCapital.SOURCE, 'otocapital')
  assert.equal(otoCapital.COMPANY, 'OTO Capital')
  assert.equal(otoCapital.OFFICIAL_BRAND_NAME, 'OTO')
  assert.equal(otoCapital.VERIFIED_ON, '2026-07-25')
  assert.equal(otoCapital.HOMEPAGE_URL, 'https://www.otocapital.in/')
  assert.equal(otoCapital.SITEMAP_URL, 'https://www.otocapital.in/sitemap.xml')
  assert.equal(otoCapital.CAREERS_URL, 'https://www.otocapital.in/careers')
  assert.equal(otoCapital.JOBS_URL, 'https://www.otocapital.in/jobs')
  assert.match(otoCapital.VERIFIED_SURFACE_SUMMARY, /OTO Capital - Not Found/i)

  assert.equal(otoCapital.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(otoCapital.sitemapHasPublicCareersRoute(sitemapXml), false)
  assert.equal(otoCapital.sitemapHasPublicCareersRoute(sitemapWithCareers), true)
  assert.equal(otoCapital.hasVerifiedNotFoundSignal(notFoundHtml), true)
  assert.equal(otoCapital.hasPublicJobsSignal(notFoundHtml), false)
  assert.equal(otoCapital.hasPublicJobsSignal(jobsHtml), true)
})

test('OTO Capital returns [] only while the official sitemap omits careers and the first-party careers routes stay 404', async () => {
  const otoCapital = await loadModule()
  const requestedUrls = []

  const jobs = await otoCapital.createOtoCapitalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === otoCapital.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === otoCapital.SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: sitemapXml,
        }
      }

      if (url === otoCapital.CAREERS_URL || url === otoCapital.JOBS_URL) {
        return {
          status: 404,
          url,
          html: notFoundHtml,
        }
      }

      throw new Error(`Unexpected OTO Capital URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    otoCapital.HOMEPAGE_URL,
    otoCapital.SITEMAP_URL,
    otoCapital.CAREERS_URL,
    otoCapital.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('OTO Capital fails closed when the homepage, sitemap, or careers routes drift into a public jobs surface', async () => {
  const otoCapital = await loadModule()

  await assert.rejects(
    otoCapital.createOtoCapitalScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>OTO</h1></body></html>',
      }),
    }),
    /homepage/i,
  )

  await assert.rejects(
    otoCapital.createOtoCapitalScraper().run({
      fetchPage: async (url) => {
        if (url === otoCapital.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === otoCapital.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapWithCareers,
          }
        }

        return {
          status: 404,
          url,
          html: notFoundHtml,
        }
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    otoCapital.createOtoCapitalScraper().run({
      fetchPage: async (url) => {
        if (url === otoCapital.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === otoCapital.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml,
          }
        }

        return {
          status: 200,
          url,
          html: jobsHtml,
        }
      },
    }),
    /public jobs/i,
  )
})

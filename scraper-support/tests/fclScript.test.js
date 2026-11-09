import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>FIREFLY CAMPUS LAUNDRY - Express Laundry Coimbatore</title>
    <meta name="description" content="Express laundry Coimbatore - FIREFLY CAMPUS LAUNDRY: 24 hours laundry service P.N. Pudur, commercial &amp; hostel washing, quick turnaround and premium care.">
    <link rel="canonical" href="https://fcl.in/">
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": "https://fcl.in/#organization",
            "name": "FCL",
            "url": "https://fcl.in/",
            "telephone": "+919944008811"
          }
        ]
      }
    </script>
  </head>
  <body class="home">
    <header>
      <a href="https://fcl.in/">
        <img alt="Firefly Campus Laundry logo" src="https://fcl.in/wp-content/uploads/2024/08/firefly-campus-laundry-logo.webp">
      </a>
      <a href="tel:04224173837">0422-4173837</a>
      <a href="https://api.whatsapp.com/send/?phone=919944008811&amp;text=Hi+FCL">WhatsApp</a>
    </header>
    <main>
      <h1>FIREFLY CAMPUS LAUNDRY</h1>
      <p>Express laundry Coimbatore with 24 hours laundry service P.N. Pudur.</p>
      <p>FCL offers doorstep laundry service entire coimbatore.</p>
      <section>
        <h2>Commercial Laundry</h2>
        <p>Star Hotels</p>
        <p>Hospitals</p>
        <p>Factories</p>
        <p>Hostels</p>
      </section>
      <section>
        <h2>Services</h2>
        <p>Steam pressing</p>
        <p>Pickup and delivery service</p>
      </section>
      <a href="https://fcl.in/contact/">Contact</a>
      <a href="https://fcl.in/hotel-laundry/">Star Hotels</a>
      <a href="https://fcl.in/hospital-laundry/">Hospitals</a>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en-US">
  <head><title>Page not found - FCL</title></head>
  <body>
    <h1>Oops! That page can’t be found.</h1>
    <a href="https://fcl.in/">Back to home</a>
  </body>
</html>
`

const loadFclModule = async () => {
  try {
    return await import('../../scraper/fcl/script.js')
  } catch {
    assert.fail('Expected FCL scraper module at ../../scraper/fcl/script.js')
  }
}

test('FCL sentinel constants stay pinned to the verified first-party no-public-jobs surface', async () => {
  const fcl = await loadFclModule()

  assert.equal(fcl.SOURCE, 'fcl')
  assert.equal(fcl.COMPANY, 'FCL')
  assert.equal(fcl.OFFICIAL_BRAND_NAME, 'Firefly Campus Laundry')
  assert.equal(fcl.VERIFIED_ON, '2026-07-15')
  assert.equal(fcl.HOMEPAGE_URL, 'https://fcl.in/')
  assert.deepEqual(fcl.CAREERS_ROUTE_URLS, [
    'https://fcl.in/careers',
    'https://fcl.in/career',
    'https://fcl.in/jobs',
    'https://fcl.in/join-us',
    'https://fcl.in/openings',
    'https://fcl.in/work-with-us',
    'https://fcl.in/current-openings',
  ])
  assert.match(fcl.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)

  assert.equal(fcl.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(fcl.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(
    fcl.hasFirstPartyCareerLikeLink('<a href="https://fcl.in/careers">Careers</a>'),
    true,
  )
  assert.equal(fcl.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    fcl.hasPublicJobsSignal('<a href="https://jobs.lever.co/fcl">Open positions</a>'),
    true,
  )
  assert.equal(
    fcl.isVerifiedMissingFirstPartyRoute({
      status: 404,
      url: 'https://fcl.in/careers',
      text: missingRouteHtml,
    }),
    true,
  )
})

test('FCL sentinel returns [] only while the verified first-party surface exposes no public jobs board', async () => {
  const fcl = await loadFclModule()
  const requestedUrls = []

  const jobs = await fcl.createFclScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === fcl.HOMEPAGE_URL) {
        return { ok: true, status: 200, url, text: homepageHtml }
      }

      if (fcl.CAREERS_ROUTE_URLS.includes(url)) {
        return { ok: false, status: 404, url, text: missingRouteHtml }
      }

      throw new Error(`Unexpected FCL URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    fcl.HOMEPAGE_URL,
    ...fcl.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('FCL sentinel fails closed when the verified first-party surface drifts into a public jobs surface', async () => {
  const fcl = await loadFclModule()

  await assert.rejects(
    fcl.createFclScraper().run({
      fetchPage: async (url) => {
        if (url === fcl.HOMEPAGE_URL) {
          return {
            ok: true,
            status: 200,
            url,
            text: `${homepageHtml}<a href="https://fcl.in/careers">Careers</a>`,
          }
        }

        throw new Error(`Unexpected FCL URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    fcl.createFclScraper().run({
      fetchPage: async (url) => {
        if (url === fcl.HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: homepageHtml }
        }

        if (url === fcl.CAREERS_ROUTE_URLS[0]) {
          return {
            ok: true,
            status: 200,
            url,
            text: '<html><body><h1>Careers</h1><a href="https://jobs.lever.co/fcl">Apply now</a></body></html>',
          }
        }

        return { ok: false, status: 404, url, text: missingRouteHtml }
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )
})

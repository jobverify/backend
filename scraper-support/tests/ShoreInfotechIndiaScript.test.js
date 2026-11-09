import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Managed Data Services & AI-Powered Operations for SMBs | Shore Group</title>
  </head>
  <body>
    <header>Shore Group</header>
    <main>
      <h1>Managed Data Services That Simplify Your Operations</h1>
      <p>Designed for Small and Medium-Sized Businesses.</p>
      <p>SLA-backed outcomes - driving accuracy, speed, and measurable impact for your business.</p>
      <a href="https://www.shoregrp.com/contact">Schedule a Discovery Call</a>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Schedule a Free Discovery Call | Shore Group</title>
  </head>
  <body>
    <p>WE RESPOND WITHIN 24 HOURS</p>
    <h1>Schedule a Free Discovery Call</h1>
    <p>Schedule your discovery call and let's discuss how we can solve your biggest operational or strategic challenge.</p>
    <p>Hyderabad, India - Operations, R&amp;D</p>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head><title>404: NOT_FOUND</title></head>
  <body><div>404</div></body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Managed Data Services &amp; AI-Powered Operations for SMBs | Shore Group</title>
    <meta name="description" content="Shore Group delivers fully managed data services and AI-powered document processing for SMBs. SLA-backed outcomes, predictable pricing, powered by our Polaris platform.">
    <meta property="og:site_name" content="Shore Group">
    <link rel="canonical" href="https://www.shoregrp.com">
  </head>
  <body><h1>Operational data services for growing teams</h1></body>
</html>
`

const currentMissingRouteHtml = `The page could not be found

NOT_FOUND

bom1::7cx99-1789246426713-132ea6cd6881`

const loadShoreModule = async () => {
  try {
    return await import('../../scraper/shoreinfotechindia/script.js')
  } catch {
    assert.fail('Expected Shore Infotech India scraper module at ../../scraper/shoreinfotechindia/script.js')
  }
}

test('Shore Infotech India sentinel returns [] only while the verified first-party surface exposes no public careers board', async () => {
  const shore = await loadShoreModule()
  const requestedUrls = []

  assert.equal(shore.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(shore.hasOfficialContactSignal(contactHtml), true)
  assert.equal(shore.hasPublicJobsSignal(homepageHtml), false)

  const jobs = await shore.createShoreInfotechIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === shore.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === shore.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (shore.CAREERS_ROUTE_URLS.includes(url)) return { status: 404, url, html: missingRouteHtml }

      throw new Error(`Unexpected Shore URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    shore.HOMEPAGE_URL,
    shore.CONTACT_URL,
    ...shore.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Shore Infotech India sentinel fails closed when a first-party careers route appears', async () => {
  const shore = await loadShoreModule()

  await assert.rejects(
    shore.createShoreInfotechIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === shore.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === shore.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === shore.CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1><a href="/apply">Apply Now</a></body></html>' }
        }
        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )
})

test('Shore Infotech India sentinel fails closed when homepage identity drifts', async () => {
  const shore = await loadShoreModule()

  await assert.rejects(
    shore.createShoreInfotechIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === shore.HOMEPAGE_URL) return { status: 200, url, html: '<html><body>Unknown</body></html>' }
        throw new Error(`Unexpected Shore URL: ${url}`)
      },
    }),
    /homepage surface no longer matches/i,
  )
})

test('Shore Infotech India accepts the current stable head identity and plain-text first-party 404s', async () => {
  const shore = await loadShoreModule()

  assert.equal(shore.hasOfficialHomepageSignal(currentHomepageHtml), true)
  const jobs = await shore.run({
    fetchPage: async (url) => {
      if (url === shore.HOMEPAGE_URL) return { status: 200, url, html: currentHomepageHtml }
      if (url === shore.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (shore.CAREERS_ROUTE_URLS.includes(url)) return { status: 404, url, html: currentMissingRouteHtml }
      throw new Error(`Unexpected Shore URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

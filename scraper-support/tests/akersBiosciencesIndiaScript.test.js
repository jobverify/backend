import assert from 'node:assert/strict'
import test from 'node:test'

const parkedDomainHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>AkersBiosciences.com is for sale | HugeDomains</title>
  </head>
  <body>
    <h1>AkersBiosciences.com is for sale</h1>
    <p>HugeDomains helps you secure premium domains.</p>
    <a href="https://www.hugedomains.com/domain_profile.cfm?d=akersbiosciences.com">Buy now</a>
  </body>
</html>
`

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head><title>Akers Bio | Biotechnology Research, Life Sciences & Innovation</title></head>
  <body>
    <nav>About Products Technology and R&amp;D Investor Center News Contact Us</nav>
    <main>
      <h1>Akers Bio</h1>
      <p>Biotechnology Research, Life Sciences &amp; Innovation</p>
      <p>Akers Biosciences, Inc.</p>
    </main>
  </body>
</html>
`

const contactPageHtml = `
<!doctype html>
<html lang="en">
  <head><title>Contact Us - Akers Biosciences, Inc.</title></head>
  <body>
    <nav>About Products Technology and R&amp;D Investor Center</nav>
    <main><h1>Contact Us</h1><p>Akers Biosciences, Inc.</p></main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>http://www.akersbio.com</loc></url>
  <url><loc>http://www.akersbio.com/about/company-overview</loc></url>
  <url><loc>http://www.akersbio.com/products</loc></url>
  <url><loc>http://www.akersbio.com/contact-us</loc></url>
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html>
  <head><title>404 Not Found</title></head>
  <body>
    <h1>Not Found</h1>
    <p>The requested URL was not found on this server.</p>
    <address>Apache/2.4.58 (Ubuntu) Server at www.akersbio.com Port 80</address>
  </body>
</html>
`

const loadAkersModule = async () => {
  try {
    return await import('../../scraper/akersbiosciencesindia/script.js')
  } catch {
    assert.fail('Expected Akers Biosciences India scraper module at ../../scraper/akersbiosciencesindia/script.js')
  }
}

test('Akers Biosciences India sentinel pins the parked exact-name domain, live official host, and missing jobs routes', async () => {
  const akers = await loadAkersModule()

  assert.equal(akers.SOURCE, 'akersbiosciencesindia')
  assert.equal(akers.COMPANY, 'Akers Biosciences India')
  assert.equal(akers.OFFICIAL_BRAND_NAME, 'Akers Biosciences')
  assert.equal(akers.PARKED_EXACT_NAME_URL, 'https://akersbiosciences.com/')
  assert.deepEqual(akers.PARKED_ROUTE_URLS, [
    'https://akersbiosciences.com/',
    'https://akersbiosciences.com/careers',
    'https://akersbiosciences.com/jobs',
  ])
  assert.equal(akers.OFFICIAL_HOST_URL, 'https://akersbio.com/')
  assert.deepEqual(akers.OFFICIAL_SURFACE_URLS, [
    'https://akersbio.com/',
    'https://akersbio.com/sitemap.xml',
    'https://akersbio.com/contact-us',
  ])
  assert.deepEqual(akers.MISSING_JOB_ROUTE_URLS, [
    'https://akersbio.com/careers',
    'https://akersbio.com/jobs',
    'https://akersbio.com/openings',
  ])

  assert.match(akers.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(akers.hasVerifiedParkedSurface(parkedDomainHtml), true)
  assert.equal(akers.hasPublicJobsSignal(parkedDomainHtml), false)
  assert.equal(akers.hasVerifiedOfficialSurface({ status: 200, url: 'https://www.akersbio.com/', html: officialHomepageHtml }), true)
  assert.equal(akers.hasVerifiedOfficialSurface({ status: 200, url: 'https://www.akersbio.com/contact-us', html: contactPageHtml }), true)
  assert.equal(akers.hasVerifiedOfficialSurface({ status: 200, url: 'https://www.akersbio.com/sitemap.xml', html: sitemapXml }), true)
  assert.equal(akers.isMissingJobRoute({ status: 404, url: 'https://www.akersbio.com/careers', html: missingRouteHtml }), true)
  assert.equal(
    akers.hasPublicJobsSignal('<html><body><h1>Current Openings</h1><a href="https://jobs.lever.co/akers">Apply now</a></body></html>'),
    true,
  )
})

test('Akers Biosciences India sentinel returns [] only while checked public routes expose no jobs', async () => {
  const akers = await loadAkersModule()
  const requestedUrls = []

  const jobs = await akers.createAkersBiosciencesIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (akers.PARKED_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url: 'https://www.hugedomains.com/domain_profile.cfm?d=akersbiosciences.com',
          html: parkedDomainHtml,
        }
      }

      if (url === 'https://akersbio.com/') {
        return { status: 200, url: 'https://www.akersbio.com/', html: officialHomepageHtml }
      }

      if (url === 'https://akersbio.com/contact-us') {
        return { status: 200, url: 'https://www.akersbio.com/contact-us', html: contactPageHtml }
      }

      if (url === 'https://akersbio.com/sitemap.xml') {
        return { status: 200, url: 'https://www.akersbio.com/sitemap.xml', html: sitemapXml }
      }

      if (akers.MISSING_JOB_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url: `https://www.akersbio.com/${new URL(url).pathname.slice(1)}`,
          html: missingRouteHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ...akers.PARKED_ROUTE_URLS,
    ...akers.OFFICIAL_SURFACE_URLS,
    ...akers.MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Akers Biosciences India retries parked-domain routes over HTTP only after an HTTPS connect timeout', async () => {
  const akers = await loadAkersModule()
  const requestedUrls = []
  const connectTimeoutError = Object.assign(new TypeError('fetch failed'), {
    cause: {
      code: 'UND_ERR_CONNECT_TIMEOUT',
      message: 'Connect Timeout Error',
    },
  })
  const parkedDestinationUrl = 'https://www.hugedomains.com/domain_profile.cfm?d=akersbiosciences.com'
  const response = (status, url, html, headers = {}) => ({
    status,
    url,
    headers: {
      get: (name) => headers[String(name).toLowerCase()] ?? null,
    },
    text: async () => html,
  })
  const fetchPage = akers.createFetchPage({
    fetchImpl: async (url) => {
      requestedUrls.push(url)

      if (akers.PARKED_ROUTE_URLS.includes(url)) throw connectTimeoutError
      if (akers.PARKED_ROUTE_URLS.map((routeUrl) => routeUrl.replace('https://', 'http://')).includes(url)) {
        return response(302, url, '', { location: parkedDestinationUrl })
      }
      if (url === parkedDestinationUrl) {
        return response(200, parkedDestinationUrl, parkedDomainHtml)
      }
      if (url === 'https://akersbio.com/') {
        return response(200, 'https://www.akersbio.com/', officialHomepageHtml)
      }
      if (url === 'https://akersbio.com/sitemap.xml') {
        return response(200, 'https://www.akersbio.com/sitemap.xml', sitemapXml)
      }
      if (url === 'https://akersbio.com/contact-us') {
        return response(200, 'https://www.akersbio.com/contact-us', contactPageHtml)
      }
      if (akers.MISSING_JOB_ROUTE_URLS.includes(url)) {
        return response(404, url.replace('akersbio.com', 'www.akersbio.com'), missingRouteHtml)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  const jobs = await akers.run({ fetchPage })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    ...akers.PARKED_ROUTE_URLS.flatMap((url) => [
      url,
      url.replace('https://', 'http://'),
      parkedDestinationUrl,
    ]),
    ...akers.OFFICIAL_SURFACE_URLS,
    ...akers.MISSING_JOB_ROUTE_URLS,
  ])

  const officialHostRequests = []
  const fetchWithoutFallback = akers.createFetchPage({
    fetchImpl: async (url) => {
      officialHostRequests.push(url)
      throw connectTimeoutError
    },
  })

  await assert.rejects(fetchWithoutFallback(akers.OFFICIAL_HOST_URL), /fetch failed/)
  assert.deepEqual(officialHostRequests, [akers.OFFICIAL_HOST_URL])
})

test('Akers Biosciences India sentinel fails closed when any checked route drifts into a jobs surface', async () => {
  const akers = await loadAkersModule()

  await assert.rejects(
    akers.createAkersBiosciencesIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === akers.PARKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Akers Biosciences</title></head><body><h1>Careers</h1></body></html>',
          }
        }

        if (akers.PARKED_ROUTE_URLS.includes(url)) {
          return { status: 200, url, html: parkedDomainHtml }
        }

        if (url === 'https://akersbio.com/') {
          return { status: 200, url: 'https://www.akersbio.com/', html: officialHomepageHtml }
        }

        if (url === 'https://akersbio.com/contact-us') {
          return { status: 200, url: 'https://www.akersbio.com/contact-us', html: contactPageHtml }
        }

        if (url === 'https://akersbio.com/sitemap.xml') {
          return { status: 200, url: 'https://www.akersbio.com/sitemap.xml', html: sitemapXml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /verified parked exact-name domain surface/i,
  )

  await assert.rejects(
    akers.createAkersBiosciencesIndiaScraper().run({
      fetchPage: async (url) => {
        if (akers.PARKED_ROUTE_URLS.includes(url)) {
          return { status: 200, url, html: parkedDomainHtml }
        }

        if (url === akers.OFFICIAL_SURFACE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        if (url === 'https://akersbio.com/contact-us') {
          return { status: 200, url: 'https://www.akersbio.com/contact-us', html: contactPageHtml }
        }

        if (url === 'https://akersbio.com/sitemap.xml') {
          return { status: 200, url: 'https://www.akersbio.com/sitemap.xml', html: sitemapXml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /official canonical host route now appears to expose public jobs|official canonical host surface/i,
  )

  await assert.rejects(
    akers.createAkersBiosciencesIndiaScraper().run({
      fetchPage: async (url) => {
        if (akers.PARKED_ROUTE_URLS.includes(url)) {
          return { status: 200, url, html: parkedDomainHtml }
        }

        if (url === 'https://akersbio.com/') {
          return { status: 200, url: 'https://www.akersbio.com/', html: officialHomepageHtml }
        }

        if (url === 'https://akersbio.com/contact-us') {
          return { status: 200, url: 'https://www.akersbio.com/contact-us', html: contactPageHtml }
        }

        if (url === 'https://akersbio.com/sitemap.xml') {
          return { status: 200, url: 'https://www.akersbio.com/sitemap.xml', html: sitemapXml }
        }

        if (url === akers.MISSING_JOB_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Open roles</h1><a href="https://jobs.lever.co/akers">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /now appears to expose public jobs|verified missing canonical jobs route/i,
  )
})

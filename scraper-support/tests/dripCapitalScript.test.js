import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Trade Finance Simplified | Drip Capital</title>
    <link rel="canonical" href="https://www.dripcapital.com/">
    <meta
      name="description"
      content="Drip Capital is a Trade Finance company providing collateral-free post-shipment finance to Exporters and Importers with instant approvals and minimal documentation."
    >
  </head>
  <body>
    <main>
      <h1>Trade Finance Simplified</h1>
      <p>Drip Capital is a Trade Finance company providing collateral-free post-shipment finance to Exporters and Importers with instant approvals and minimal documentation.</p>
    </main>
  </body>
</html>
`

const legacyCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/careers/state.js">
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/careers/payload.js">
  </head>
  <body>
    <div id="__nuxt">
      <div class="shell">Careers shell</div>
    </div>
  </body>
</html>
`

const indiaCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/en-in/careers/state.js">
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/en-in/careers/payload.js">
  </head>
  <body>
    <div id="__nuxt">
      <div class="shell">India careers shell</div>
    </div>
  </body>
</html>
`

const usCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers | Join Drip Capital</title>
    <meta name="description" content="Join the Drip Capital team. Build the future of working capital access for SMBs. We are hiring engineers, analysts, and operators.">
    <link rel="canonical" href="https://www.dripcapital.com/en-us/careers/">
    <meta property="og:title" content="Careers | Join Drip Capital">
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/en-us/careers/state.js">
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/en-us/careers/payload.js">
  </head>
  <body>
    <div id="__nuxt">
      <div class="shell">US careers shell</div>
    </div>
  </body>
</html>
`

const emptyLegacyPayload = '__NUXT_JSONP__("/careers", {data:[{}],fetch:{},mutations:[]});'
const emptyIndiaPayload = '__NUXT_JSONP__("/en-in/careers", {data:[{}],fetch:{},mutations:[]});'
const emptyUsPayload = '__NUXT_JSONP__("/en-us/careers", {data:[{}],fetch:{},mutations:[]});'

const robotsTxt = `
User-agent: *
Allow: /
Sitemap: https://www.dripcapital.com/sitemap.xml
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.dripcapital.com/</loc></url>
  <url><loc>https://www.dripcapital.com/en-in/careers/</loc></url>
  <url><loc>https://www.dripcapital.com/about/</loc></url>
</urlset>
`

const sitemapWithPublicJobsXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.dripcapital.com/en-in/careers/</loc></url>
  <url><loc>https://www.dripcapital.com/en-us/careers/software-engineer/</loc></url>
  <url><loc>https://www.dripcapital.com/jobs/data-analyst/</loc></url>
</urlset>
`

const jobs404Html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Current Openings</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/dripcapital/software-engineer">Apply now</a>
  </body>
</html>
`

const loadDripCapitalModule = async () => {
  try {
    return await import('../../scraper/dripcapital/script.js')
  } catch {
    assert.fail('Expected Drip Capital scraper module at ../../scraper/dripcapital/script.js')
  }
}

test('Drip Capital helpers stay pinned to the verified homepage, careers shells, empty payloads, jobs 404, robots, and sitemap evidence', async () => {
  const dripCapital = await loadDripCapitalModule()

  assert.equal(dripCapital.SOURCE, 'dripcapital')
  assert.equal(dripCapital.COMPANY, 'Drip Capital')
  assert.equal(dripCapital.OFFICIAL_BRAND_NAME, 'Drip Capital')
  assert.equal(dripCapital.VERIFIED_ON, '2026-08-13')
  assert.equal(dripCapital.HOMEPAGE_URL, 'https://www.dripcapital.com/')
  assert.equal(dripCapital.CAREERS_PAGE_URL, 'https://www.dripcapital.com/en-in/careers/')
  assert.equal(dripCapital.LEGACY_CAREERS_URL, 'https://www.dripcapital.com/careers/')
  assert.equal(dripCapital.US_CAREERS_URL, 'https://www.dripcapital.com/en-us/careers/')
  assert.equal(
    dripCapital.LEGACY_CAREERS_PAYLOAD_URL,
    'https://assets.dripcapital.com/_nuxt/static/1786337464/careers/payload.js',
  )
  assert.equal(
    dripCapital.INDIA_CAREERS_PAYLOAD_URL,
    'https://assets.dripcapital.com/_nuxt/static/1786337464/en-in/careers/payload.js',
  )
  assert.equal(
    dripCapital.US_CAREERS_PAYLOAD_URL,
    'https://assets.dripcapital.com/_nuxt/static/1786337464/en-us/careers/payload.js',
  )
  assert.equal(dripCapital.JOBS_URL, 'https://www.dripcapital.com/jobs')
  assert.equal(dripCapital.ROBOTS_TXT_URL, 'https://www.dripcapital.com/robots.txt')
  assert.equal(dripCapital.SITEMAP_URL, 'https://www.dripcapital.com/sitemap.xml')

  assert.equal(dripCapital.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    dripCapital.hasCareersShellSignal(legacyCareersHtml, {
      routeUrl: dripCapital.LEGACY_CAREERS_URL,
      payloadUrl: dripCapital.LEGACY_CAREERS_PAYLOAD_URL,
      requireTitle: false,
      requireDescription: false,
    }),
    true,
  )
  assert.equal(
    dripCapital.hasCareersShellSignal(indiaCareersHtml, {
      routeUrl: dripCapital.CAREERS_PAGE_URL,
      payloadUrl: dripCapital.INDIA_CAREERS_PAYLOAD_URL,
      requireTitle: false,
      requireDescription: false,
    }),
    true,
  )
  assert.equal(
    dripCapital.hasCareersShellSignal(usCareersHtml, {
      routeUrl: dripCapital.US_CAREERS_URL,
      payloadUrl: dripCapital.US_CAREERS_PAYLOAD_URL,
      expectedTitle: 'Careers | Join Drip Capital',
      expectedDescription:
        'Join the Drip Capital team. Build the future of working capital access for SMBs. We are hiring engineers, analysts, and operators.',
      requireTitle: true,
      requireDescription: true,
    }),
    true,
  )
  assert.equal(
    dripCapital.extractPayloadUrl(legacyCareersHtml),
    dripCapital.LEGACY_CAREERS_PAYLOAD_URL,
  )
  assert.equal(
    dripCapital.extractPayloadUrl(indiaCareersHtml),
    dripCapital.INDIA_CAREERS_PAYLOAD_URL,
  )
  assert.equal(
    dripCapital.extractPayloadUrl(usCareersHtml),
    dripCapital.US_CAREERS_PAYLOAD_URL,
  )
  assert.equal(dripCapital.isVerifiedEmptyPayload(emptyLegacyPayload, '/careers'), true)
  assert.equal(dripCapital.isVerifiedEmptyPayload(emptyIndiaPayload, '/en-in/careers'), true)
  assert.equal(dripCapital.isVerifiedEmptyPayload(emptyUsPayload, '/en-us/careers'), true)
  assert.equal(dripCapital.hasRobotsSitemapSignal(robotsTxt), true)
  assert.deepEqual(dripCapital.extractCareerLikeUrlsFromSitemap(sitemapXml), [
    'https://www.dripcapital.com/en-in/careers/',
  ])
  assert.deepEqual(dripCapital.extractCareerLikeUrlsFromSitemap(sitemapWithPublicJobsXml), [
    'https://www.dripcapital.com/en-in/careers/',
    'https://www.dripcapital.com/en-us/careers/software-engineer/',
    'https://www.dripcapital.com/jobs/data-analyst/',
  ])
  assert.equal(
    dripCapital.isVerifiedJobs404Route({
      status: 404,
      url: dripCapital.JOBS_URL,
      html: jobs404Html,
    }),
    true,
  )
  assert.equal(dripCapital.hasPublicJobsSignal(legacyCareersHtml), false)
  assert.equal(dripCapital.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Drip Capital sentinel returns [] only while the verified careers shells and empty payload evidence remain unchanged', async () => {
  const dripCapital = await loadDripCapitalModule()
  const requestedUrls = []

  const jobs = await dripCapital.createDripCapitalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === dripCapital.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === dripCapital.LEGACY_CAREERS_URL) {
        return { status: 200, url, html: legacyCareersHtml }
      }

      if (url === dripCapital.CAREERS_PAGE_URL) {
        return { status: 200, url, html: indiaCareersHtml }
      }

      if (url === dripCapital.US_CAREERS_URL) {
        return { status: 200, url, html: usCareersHtml }
      }

      if (url === dripCapital.LEGACY_CAREERS_PAYLOAD_URL) {
        return { status: 200, url, html: emptyLegacyPayload }
      }

      if (url === dripCapital.INDIA_CAREERS_PAYLOAD_URL) {
        return { status: 200, url, html: emptyIndiaPayload }
      }

      if (url === dripCapital.US_CAREERS_PAYLOAD_URL) {
        return { status: 200, url, html: emptyUsPayload }
      }

      if (url === dripCapital.JOBS_URL) {
        return { status: 404, url, html: jobs404Html }
      }

      if (url === dripCapital.ROBOTS_TXT_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === dripCapital.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      throw new Error(`Unexpected Drip Capital URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    dripCapital.HOMEPAGE_URL,
    dripCapital.LEGACY_CAREERS_URL,
    dripCapital.LEGACY_CAREERS_PAYLOAD_URL,
    dripCapital.CAREERS_PAGE_URL,
    dripCapital.INDIA_CAREERS_PAYLOAD_URL,
    dripCapital.US_CAREERS_URL,
    dripCapital.US_CAREERS_PAYLOAD_URL,
    dripCapital.JOBS_URL,
    dripCapital.ROBOTS_TXT_URL,
    dripCapital.SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Drip Capital sentinel fails closed when the homepage, careers shells, payloads, jobs route, robots, or sitemap drift into a public jobs surface', async () => {
  const dripCapital = await loadDripCapitalModule()

  await assert.rejects(
    dripCapital.createDripCapitalScraper().run({
      fetchPage: async (url) => {
        if (url === dripCapital.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Drip Capital URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    dripCapital.createDripCapitalScraper().run({
      fetchPage: async (url) => {
        if (url === dripCapital.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_URL) {
          return { status: 200, url, html: legacyCareersHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyLegacyPayload }
        }

        if (url === dripCapital.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><body>Current Openings</body></html>' }
        }

        throw new Error(`Unexpected Drip Capital URL: ${url}`)
      },
    }),
    /india careers route/i,
  )

  await assert.rejects(
    dripCapital.createDripCapitalScraper().run({
      fetchPage: async (url) => {
        if (url === dripCapital.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_URL) {
          return { status: 200, url, html: legacyCareersHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyLegacyPayload }
        }

        if (url === dripCapital.CAREERS_PAGE_URL) {
          return { status: 200, url, html: indiaCareersHtml }
        }

        if (url === dripCapital.INDIA_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Drip Capital URL: ${url}`)
      },
    }),
    /empty india careers payload/i,
  )

  await assert.rejects(
    dripCapital.createDripCapitalScraper().run({
      fetchPage: async (url) => {
        if (url === dripCapital.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_URL) {
          return { status: 200, url, html: legacyCareersHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyLegacyPayload }
        }

        if (url === dripCapital.CAREERS_PAGE_URL) {
          return { status: 200, url, html: indiaCareersHtml }
        }

        if (url === dripCapital.INDIA_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyIndiaPayload }
        }

        if (url === dripCapital.US_CAREERS_URL) {
          return { status: 200, url, html: usCareersHtml }
        }

        if (url === dripCapital.US_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyUsPayload }
        }

        if (url === dripCapital.JOBS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Drip Capital URL: ${url}`)
      },
    }),
    /jobs route/i,
  )

  await assert.rejects(
    dripCapital.createDripCapitalScraper().run({
      fetchPage: async (url) => {
        if (url === dripCapital.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_URL) {
          return { status: 200, url, html: legacyCareersHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyLegacyPayload }
        }

        if (url === dripCapital.CAREERS_PAGE_URL) {
          return { status: 200, url, html: indiaCareersHtml }
        }

        if (url === dripCapital.INDIA_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyIndiaPayload }
        }

        if (url === dripCapital.US_CAREERS_URL) {
          return { status: 200, url, html: usCareersHtml }
        }

        if (url === dripCapital.US_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyUsPayload }
        }

        if (url === dripCapital.JOBS_URL) {
          return { status: 404, url, html: jobs404Html }
        }

        if (url === dripCapital.ROBOTS_TXT_URL) {
          return { status: 200, url, html: 'User-agent: *' }
        }

        throw new Error(`Unexpected Drip Capital URL: ${url}`)
      },
    }),
    /robots/i,
  )

  await assert.rejects(
    dripCapital.createDripCapitalScraper().run({
      fetchPage: async (url) => {
        if (url === dripCapital.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_URL) {
          return { status: 200, url, html: legacyCareersHtml }
        }

        if (url === dripCapital.LEGACY_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyLegacyPayload }
        }

        if (url === dripCapital.CAREERS_PAGE_URL) {
          return { status: 200, url, html: indiaCareersHtml }
        }

        if (url === dripCapital.INDIA_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyIndiaPayload }
        }

        if (url === dripCapital.US_CAREERS_URL) {
          return { status: 200, url, html: usCareersHtml }
        }

        if (url === dripCapital.US_CAREERS_PAYLOAD_URL) {
          return { status: 200, url, html: emptyUsPayload }
        }

        if (url === dripCapital.JOBS_URL) {
          return { status: 404, url, html: jobs404Html }
        }

        if (url === dripCapital.ROBOTS_TXT_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === dripCapital.SITEMAP_URL) {
          return { status: 200, url, html: sitemapWithPublicJobsXml }
        }

        throw new Error(`Unexpected Drip Capital URL: ${url}`)
      },
    }),
    /sitemap/i,
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

const loadCampalinModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Campalin scraper module at ./script.js')
  }
}

const homepageHtml = `
<!DOCTYPE html>
<html lang="en-IN">
  <head>
    <title>campalin.in</title>
    <meta name="author" content="campalin.in" />
    <meta name="generator" content="Starfield Technologies; Go Daddy Website Builder 8.0.0000" />
  </head>
  <body>
    <main>
      <a href="/">campalin.in</a>
      <h1>Launching Soon</h1>
      <p>Contact Us</p>
      <p>Copyright Â© 2025 campalin.in - All Rights Reserved.</p>
      <p>Powered by GoDaddy</p>
    </main>
  </body>
</html>
`

const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>http://campalin.in/sitemap.website.xml</loc>
  </sitemap>
  <sitemap>
    <loc>http://campalin.in/sitemap.ols.xml</loc>
  </sitemap>
</sitemapindex>`

const websiteSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>http://campalin.in/</loc>
    <lastmod>2025-07-28</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1</priority>
  </url>
</urlset>`

const missingCareersPage = {
  status: 404,
  url: 'https://campalin.in/careers',
  html: homepageHtml,
}

const timedOutSurface = (url) => ({
  url,
  finalUrl: url,
  status: null,
  html: null,
  errorKind: 'timeout',
})

const tlsDisconnectedSurface = (url) => ({
  url,
  finalUrl: url,
  status: null,
  html: null,
  errorKind: 'timeout',
  errorMessage: 'Client network socket disconnected before secure TLS connection was established',
})

const tlsDisconnectedNetworkSurface = (url) => ({
  url,
  finalUrl: url,
  status: null,
  html: null,
  errorKind: 'network',
  errorMessage: 'Client network socket disconnected before secure TLS connection was established',
})

const publicJobsPage = {
  status: 200,
  url: 'https://campalin.in/careers',
  html: `
    <html>
      <head><title>Careers | Campalin</title></head>
      <body>
        <main>
          <h1>Current Openings</h1>
          <article>
            <h2>Founding Engineer</h2>
            <a href="/careers/founding-engineer">Apply now</a>
          </article>
        </main>
      </body>
    </html>
  `,
}

const missingRouteWithGenericCareersCopy = {
  status: 404,
  url: 'https://campalin.in/work-with-us',
  html: `
    <html>
      <head><title>404 Not Found</title></head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/careers">Careers</a>
        </nav>
        <main>
          <h1>Page not found</h1>
          <p>The page you requested could not be found.</p>
        </main>
      </body>
    </html>
  `,
}

const placeholderCareersAliasPage = {
  status: 200,
  url: 'https://campalin.in/work-with-us',
  finalUrl: 'https://campalin.in/',
  html: homepageHtml,
}

test('Campalin sentinel pins the verified Campalin placeholder-or-timeout first-party surface', async () => {
  const campalin = await loadCampalinModule()

  assert.equal(campalin.SOURCE, 'campalin')
  assert.equal(campalin.COMPANY, 'Campalin')
  assert.equal(campalin.COMPANY_DOMAIN, 'campalin.in')
  assert.equal(campalin.VERIFIED_AT, '2026-08-15')
  assert.equal(campalin.HOMEPAGE_URL, 'https://campalin.in/')
  assert.equal(campalin.SITEMAP_INDEX_URL, 'https://campalin.in/sitemap.xml')
  assert.equal(campalin.WEBSITE_SITEMAP_URL, 'https://campalin.in/sitemap.website.xml')
  assert.deepEqual(campalin.FIRST_PARTY_PLACEHOLDER_URLS, [
    'https://campalin.in/',
    'https://campalin.in/sitemap.xml',
    'https://campalin.in/sitemap.website.xml',
  ])
  assert.deepEqual(campalin.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://campalin.in/careers',
    'https://campalin.in/career',
    'https://campalin.in/jobs',
    'https://campalin.in/job',
    'https://campalin.in/join-us',
    'https://campalin.in/work-with-us',
  ])

  assert.equal(campalin.isExpectedUnreachableSurface(timedOutSurface(campalin.HOMEPAGE_URL)), true)
  assert.equal(campalin.isExpectedUnreachableSurface(tlsDisconnectedSurface(campalin.HOMEPAGE_URL)), true)
  assert.equal(campalin.isExpectedUnreachableSurface(tlsDisconnectedNetworkSurface(campalin.HOMEPAGE_URL)), true)
  assert.equal(campalin.isExpectedUnreachableSurface({ errorKind: 'dns' }), false)
  assert.equal(campalin.isUnexpectedReachableSurface({ status: 200, html: homepageHtml }), true)
  assert.equal(campalin.isUnexpectedReachableSurface(timedOutSurface(campalin.HOMEPAGE_URL)), false)
  assert.equal(campalin.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(campalin.hasVerifiedSitemapIndexSignal(sitemapIndexXml), true)
  assert.equal(campalin.hasVerifiedWebsiteSitemapSignal(websiteSitemapXml), true)
  assert.equal(campalin.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(campalin.hasPublicJobsSignal(publicJobsPage.html), true)
  assert.equal(campalin.hasPublicJobsSignal(missingRouteWithGenericCareersCopy.html), false)
})

test('Campalin sentinel recognizes the verified no-public-careers routes', async () => {
  const campalin = await loadCampalinModule()

  assert.equal(campalin.isVerifiedNoPublicCareersRoute(missingCareersPage), true)
  assert.equal(campalin.isVerifiedNoPublicCareersRoute(missingRouteWithGenericCareersCopy), true)
  assert.equal(campalin.isVerifiedNoPublicCareersRoute(placeholderCareersAliasPage), true)
  assert.equal(campalin.isVerifiedNoPublicCareersRoute(publicJobsPage), false)
})

test('Campalin sentinel returns [] while the verified placeholder pages remain reachable', async () => {
  const campalin = await loadCampalinModule()
  const requestedUrls = []

  const jobs = await campalin.createCampalinScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (url === campalin.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          finalUrl: url,
          html: homepageHtml,
          errorKind: null,
        }
      }

      if (url === campalin.SITEMAP_INDEX_URL) {
        return {
          status: 200,
          url,
          finalUrl: url,
          html: sitemapIndexXml,
          errorKind: null,
        }
      }

      if (url === campalin.WEBSITE_SITEMAP_URL) {
        return {
          status: 200,
          url,
          finalUrl: url,
          html: websiteSitemapXml,
          errorKind: null,
        }
      }

      return {
        ...missingCareersPage,
        url,
        finalUrl: url,
        errorKind: null,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    ...campalin.FIRST_PARTY_PLACEHOLDER_URLS,
    ...campalin.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Campalin sentinel also returns [] while the verified placeholder and careers routes all time out', async () => {
  const campalin = await loadCampalinModule()
  const requestedUrls = []

  const jobs = await campalin.createCampalinScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      return timedOutSurface(url)
    },
  })

  assert.deepEqual(requestedUrls, [
    ...campalin.FIRST_PARTY_PLACEHOLDER_URLS,
    ...campalin.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Campalin sentinel also returns [] while the verified first-party routes disconnect before TLS is established', async () => {
  const campalin = await loadCampalinModule()
  const requestedUrls = []

  const jobs = await campalin.createCampalinScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      return tlsDisconnectedSurface(url)
    },
  })

  assert.deepEqual(requestedUrls, [
    ...campalin.FIRST_PARTY_PLACEHOLDER_URLS,
    ...campalin.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Campalin sentinel also returns [] while the verified first-party routes report TLS disconnects as network transport failures', async () => {
  const campalin = await loadCampalinModule()
  const requestedUrls = []

  const jobs = await campalin.createCampalinScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      return tlsDisconnectedNetworkSurface(url)
    },
  })

  assert.deepEqual(requestedUrls, [
    ...campalin.FIRST_PARTY_PLACEHOLDER_URLS,
    ...campalin.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Campalin sentinel fails closed when the placeholder surface drifts or starts exposing jobs', async () => {
  const campalin = await loadCampalinModule()

  await assert.rejects(
    campalin.createCampalinScraper().run({
      probeUrl: async (url) => {
        if (url === campalin.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: '<html><body><h1>Campalin</h1></body></html>',
            errorKind: null,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    campalin.createCampalinScraper().run({
      probeUrl: async (url) => {
        if (url === campalin.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: homepageHtml,
            errorKind: null,
          }
        }

        if (url === campalin.SITEMAP_INDEX_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: sitemapIndexXml.replace('</sitemapindex>', '<sitemap><loc>http://campalin.in/careers</loc></sitemap></sitemapindex>'),
            errorKind: null,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap index no longer matches/i,
  )

  await assert.rejects(
    campalin.createCampalinScraper().run({
      probeUrl: async (url) => {
        if (url === campalin.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: homepageHtml,
            errorKind: null,
          }
        }

        if (url === campalin.SITEMAP_INDEX_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: sitemapIndexXml,
            errorKind: null,
          }
        }

        if (url === campalin.WEBSITE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: `${websiteSitemapXml}<loc>http://campalin.in/careers</loc>`,
            errorKind: null,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /website sitemap no longer matches/i,
  )

  await assert.rejects(
    campalin.createCampalinScraper().run({
      probeUrl: async (url) => {
        if (url === campalin.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: homepageHtml,
            errorKind: null,
          }
        }

        if (url === campalin.SITEMAP_INDEX_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: sitemapIndexXml,
            errorKind: null,
          }
        }

        if (url === campalin.WEBSITE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            html: websiteSitemapXml,
            errorKind: null,
          }
        }

        return {
          ...publicJobsPage,
          url,
          finalUrl: url,
          errorKind: null,
        }
      },
    }),
    /careers route changed materially or now exposes public jobs/i,
  )

  await assert.rejects(
    campalin.createCampalinScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
      }),
    }),
    /verified unreachable surface changed materially/i,
  )
})

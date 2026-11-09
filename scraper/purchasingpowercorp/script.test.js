import assert from 'node:assert/strict'
import test from 'node:test'

const loadPurchasingPowerCorpModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en" data-beasties-container>
  <head>
    <meta charset="utf-8">
    <title>Purchasing Power</title>
    <base href="/">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://ui.purchasingpower.com/spartacus/styles-NWLWWK3D.css">
  </head>
  <body>
    <app-root></app-root>
    <script src="https://ui.purchasingpower.com/spartacus/main-2RKKQNJI.js"></script>
  </body>
</html>
`

const verifiedRouteFallbackHtml = officialHomepageHtml
const verifiedLegacyCareersTargetHtml = officialHomepageHtml

const verifiedSitemapXml = `
<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.purchasingpower.com/</loc>
  </url>
  <url>
    <loc>https://www.purchasingpower.com/product-catalog/computers</loc>
  </url>
  <url>
    <loc>https://www.purchasingpower.com/financial-wellness</loc>
  </url>
  <url>
    <loc>https://www.purchasingpower.com/contact-us</loc>
  </url>
</urlset>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Purchasing Power Careers</title>
  </head>
  <body>
    <main>
      <h1>Open Positions</h1>
      <p>Search jobs across our teams.</p>
      <a href="https://jobs.lever.co/purchasingpower/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Purchasing Power Corp sentinel stays pinned to the verified homepage shell, sitemap, robots, and redirect contract', async () => {
  const purchasingPowerCorp = await loadPurchasingPowerCorpModule()
  assert.ok(purchasingPowerCorp, 'Expected Purchasing Power Corp scraper module at ./script.js')

  assert.equal(purchasingPowerCorp.SOURCE, 'purchasingpowercorp')
  assert.equal(purchasingPowerCorp.COMPANY, 'Purchasing Power Corp')
  assert.equal(purchasingPowerCorp.HOMEPAGE_URL, 'https://www.purchasingpower.com/')
  assert.equal(purchasingPowerCorp.ROBOTS_URL, 'https://www.purchasingpower.com/robots.txt')
  assert.equal(purchasingPowerCorp.SITEMAP_URL, 'https://www.purchasingpower.com/sitemap.xml')
  assert.equal(
    purchasingPowerCorp.LEGACY_CAREERS_HOST_URL,
    'https://careers.purchasingpower.com/',
  )
  assert.equal(
    purchasingPowerCorp.LEGACY_CAREERS_TARGET_URL,
    'https://www.purchasingpower.com/?domain=careers',
  )
  assert.deepEqual(purchasingPowerCorp.CHECKED_ROUTE_URLS, [
    'https://www.purchasingpower.com/careers',
    'https://www.purchasingpower.com/careers/',
    'https://www.purchasingpower.com/career',
    'https://www.purchasingpower.com/career/',
    'https://www.purchasingpower.com/jobs',
    'https://www.purchasingpower.com/jobs/',
  ])
  assert.equal(purchasingPowerCorp.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(purchasingPowerCorp.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(
    purchasingPowerCorp.isVerifiedRouteFallbackShell(verifiedRouteFallbackHtml, officialHomepageHtml),
    true,
  )
  assert.equal(
    purchasingPowerCorp.isVerifiedMissingRobotsPage({
      status: 404,
      html: 'The resource you are looking for has been removed, had its name changed, or is temporarily unavailable.',
    }),
    true,
  )
  assert.equal(purchasingPowerCorp.sitemapHasCareerLikeUrl(verifiedSitemapXml), false)
  assert.equal(
    purchasingPowerCorp.isVerifiedLegacyCareersRedirect({
      status: 302,
      headers: { location: 'https://purchasingpower.com/?domain=careers' },
    }),
    true,
  )
  assert.equal(
    purchasingPowerCorp.isVerifiedLegacyCareersRedirect({
      status: 302,
      headers: { location: purchasingPowerCorp.LEGACY_CAREERS_TARGET_URL },
    }),
    true,
  )
})

test('Purchasing Power Corp sentinel returns no jobs while the verified homepage shell and careers routes remain unchanged', async () => {
  const purchasingPowerCorp = await loadPurchasingPowerCorpModule()
  assert.ok(purchasingPowerCorp, 'Expected Purchasing Power Corp scraper module at ./script.js')

  const requests = []
  const jobs = await purchasingPowerCorp.createPurchasingPowerCorpScraper().run({
    fetchPage: async (url, options = {}) => {
      requests.push({ url, manualRedirect: options.manualRedirect === true })

      if (url === purchasingPowerCorp.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === purchasingPowerCorp.ROBOTS_URL) {
        return {
          status: 404,
          url,
          html: 'The resource you are looking for has been removed, had its name changed, or is temporarily unavailable.',
        }
      }

      if (url === purchasingPowerCorp.SITEMAP_URL) {
        return { status: 200, url, html: verifiedSitemapXml }
      }

      if (purchasingPowerCorp.CHECKED_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: verifiedRouteFallbackHtml }
      }

      if (url === purchasingPowerCorp.LEGACY_CAREERS_HOST_URL) {
        return {
          status: 302,
          url,
          headers: { location: 'https://purchasingpower.com/?domain=careers' },
          html: '',
        }
      }

      if (url === purchasingPowerCorp.LEGACY_CAREERS_TARGET_URL) {
        return {
          status: 200,
          url,
          html: verifiedLegacyCareersTargetHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    { url: purchasingPowerCorp.HOMEPAGE_URL, manualRedirect: false },
    { url: purchasingPowerCorp.ROBOTS_URL, manualRedirect: false },
    { url: purchasingPowerCorp.SITEMAP_URL, manualRedirect: false },
    ...purchasingPowerCorp.CHECKED_ROUTE_URLS.map((url) => ({ url, manualRedirect: false })),
    { url: purchasingPowerCorp.LEGACY_CAREERS_HOST_URL, manualRedirect: true },
    { url: purchasingPowerCorp.LEGACY_CAREERS_TARGET_URL, manualRedirect: false },
  ])
  assert.deepEqual(jobs, [])
})

test('Purchasing Power Corp sentinel fails closed when the homepage, robots, sitemap, routes, or legacy careers redirect drift', async () => {
  const purchasingPowerCorp = await loadPurchasingPowerCorpModule()
  assert.ok(purchasingPowerCorp, 'Expected Purchasing Power Corp scraper module at ./script.js')

  await assert.rejects(
    purchasingPowerCorp.createPurchasingPowerCorpScraper().run({
      fetchPage: async (url) => {
        if (url === purchasingPowerCorp.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body><main>Unexpected</main></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage shell/i,
  )

  await assert.rejects(
    purchasingPowerCorp.createPurchasingPowerCorpScraper().run({
      fetchPage: async (url) => {
        if (url === purchasingPowerCorp.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === purchasingPowerCorp.ROBOTS_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /robots surface/i,
  )

  await assert.rejects(
    purchasingPowerCorp.createPurchasingPowerCorpScraper().run({
      fetchPage: async (url) => {
        if (url === purchasingPowerCorp.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === purchasingPowerCorp.ROBOTS_URL) {
          return {
            status: 404,
            url,
            html: 'The resource you are looking for has been removed, had its name changed, or is temporarily unavailable.',
          }
        }

        if (url === purchasingPowerCorp.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: verifiedSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://www.purchasingpower.com/careers</loc></url></urlset>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap no longer matches/i,
  )

  await assert.rejects(
    purchasingPowerCorp.createPurchasingPowerCorpScraper().run({
      fetchPage: async (url) => {
        if (url === purchasingPowerCorp.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === purchasingPowerCorp.ROBOTS_URL) {
          return {
            status: 404,
            url,
            html: 'The resource you are looking for has been removed, had its name changed, or is temporarily unavailable.',
          }
        }

        if (url === purchasingPowerCorp.SITEMAP_URL) {
          return { status: 200, url, html: verifiedSitemapXml }
        }

        if (url === purchasingPowerCorp.CHECKED_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (purchasingPowerCorp.CHECKED_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url, html: verifiedRouteFallbackHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /route fallback changed materially or now exposes public jobs/i,
  )

  await assert.rejects(
    purchasingPowerCorp.createPurchasingPowerCorpScraper().run({
      fetchPage: async (url, options = {}) => {
        if (url === purchasingPowerCorp.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === purchasingPowerCorp.ROBOTS_URL) {
          return {
            status: 404,
            url,
            html: 'The resource you are looking for has been removed, had its name changed, or is temporarily unavailable.',
          }
        }

        if (url === purchasingPowerCorp.SITEMAP_URL) {
          return { status: 200, url, html: verifiedSitemapXml }
        }

        if (purchasingPowerCorp.CHECKED_ROUTE_URLS.includes(url)) {
          return { status: 200, url, html: verifiedRouteFallbackHtml }
        }

        if (url === purchasingPowerCorp.LEGACY_CAREERS_HOST_URL) {
          return options.manualRedirect
            ? {
                status: 302,
                url,
                headers: { location: 'https://jobs.purchasingpower.com/' },
                html: '',
              }
            : {
                status: 200,
                url,
                html: publicJobsHtml,
              }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /legacy careers redirect/i,
  )
})

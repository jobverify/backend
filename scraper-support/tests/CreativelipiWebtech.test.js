import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/creativelipiwebtech/script.js')

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Creative Lipi | Scalable Business Solutions for Smarter Growth</title>
    <link rel="canonical" href="https://creativelipi.com/" />
  </head>
  <body>
    <h1>Creative Lipi</h1>
    <p>Scalable Business Solutions for Smarter Growth</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Contact Us - Creative Lipi</title>
  </head>
  <body>
    <h1>Contact Us</h1>
    <p>Let's Connect</p>
    <p>Connect with Creative Lipi today to explore tailored business solutions.</p>
  </body>
</html>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://creativelipi.com/</loc>
  </url>
  <url>
    <loc>https://creativelipi.com/contact-us/</loc>
  </url>
</urlset>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/creativelipiwebtech/catalog.js')
  } catch {
    assert.fail('Expected Creativelipi Webtech catalog module at ../../scraper/creativelipiwebtech/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/creativelipiwebtech/script.js')
  } catch {
    assert.fail('Expected Creativelipi Webtech scraper module at ../../scraper/creativelipiwebtech/script.js')
  }
}

test('Creativelipi Webtech local catalog captures the verified fail-closed no-public-careers contract', async () => {
  const { CREATIVELIPI_WEBTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const scriptModule = await loadScriptModule()

  assert.equal(defaultCatalog, CREATIVELIPI_WEBTECH_CATALOG)
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.source, 'creativelipiwebtech')
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.companyName, 'Creativelipi Webtech')
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.officialBrandName, 'Creative Lipi')
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.adapter, 'script')
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.homepageUrl, 'https://creativelipi.com/')
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.companyCareerPage, 'https://creativelipi.com/contact-us/')
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.countryFilter, 'India')
  assert.equal(
    CREATIVELIPI_WEBTECH_CATALOG.paginationStrategy,
    'homepage-plus-contact-page-plus-page-sitemap-validation',
  )
  assert.equal(
    CREATIVELIPI_WEBTECH_CATALOG.extractionStrategy,
    'verified-homepage+verified-contact-page+verified-page-sitemap-without-careers-route+fail-closed-sentinel',
  )
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.companyDomain, 'creativelipi.com')
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.verifiedOn, '2026-07-18')
  assert.equal(CREATIVELIPI_WEBTECH_CATALOG.modulePath, modulePath)
  assert.match(CREATIVELIPI_WEBTECH_CATALOG.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(CREATIVELIPI_WEBTECH_CATALOG.verifiedSurfaceSummary, /page-sitemap\.xml/i)
  assert.match(CREATIVELIPI_WEBTECH_CATALOG.verifiedSurfaceSummary, /no public careers, jobs, join-us, or work-with-us route/i)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, CREATIVELIPI_WEBTECH_CATALOG)

  const report = generateCompanyCoverageReport({
    csvText: 'Creativelipi Webtech\n',
    catalog: [CREATIVELIPI_WEBTECH_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Creativelipi Webtech stays fail-closed while the first-party site exposes no careers route', async () => {
  const creativelipi = await loadScriptModule()

  assert.equal(creativelipi.SOURCE, 'creativelipiwebtech')
  assert.equal(creativelipi.COMPANY, 'Creativelipi Webtech')
  assert.equal(creativelipi.HOMEPAGE_URL, 'https://creativelipi.com/')
  assert.equal(creativelipi.CONTACT_URL, 'https://creativelipi.com/contact-us/')
  assert.equal(creativelipi.PAGE_SITEMAP_URL, 'https://creativelipi.com/page-sitemap.xml')
  assert.equal(creativelipi.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(creativelipi.hasOfficialContactPageSignal(contactHtml), true)
  assert.equal(creativelipi.hasExpectedPageSitemapSurface(pageSitemapXml), true)
  assert.equal(creativelipi.hasCareersLikeRoute(pageSitemapXml), false)

  const jobs = await creativelipi.run({
    fetchText: async (url) => {
      if (url === creativelipi.HOMEPAGE_URL) return homepageHtml
      if (url === creativelipi.CONTACT_URL) return contactHtml
      if (url === creativelipi.PAGE_SITEMAP_URL) return pageSitemapXml
      throw new Error(`Unexpected Creativelipi URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Creativelipi Webtech fails closed when a public careers-like route appears in the first-party sitemap', async () => {
  const creativelipi = await loadScriptModule()

  await assert.rejects(
    creativelipi.run({
      fetchText: async (url) => {
        if (url === creativelipi.HOMEPAGE_URL) return homepageHtml
        if (url === creativelipi.CONTACT_URL) return contactHtml
        if (url === creativelipi.PAGE_SITEMAP_URL) {
          return `
            <?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://creativelipi.com/</loc></url>
              <url><loc>https://creativelipi.com/contact-us/</loc></url>
              <url><loc>https://creativelipi.com/careers/</loc></url>
            </urlset>
          `
        }

        throw new Error(`Unexpected Creativelipi URL: ${url}`)
      },
    }),
    /public jobs surface changed materially/i,
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Bankai Infotech</title>
  </head>
  <body>
    <h1>Bankai Infotech</h1>
    <p>Digital transformation services.</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us | Bankai Infotech</title>
  </head>
  <body>
    <h1>Contact Us</h1>
    <h2>Corporate Office Bankai Infotech</h2>
  </body>
</html>
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://bankaiinfotech.com/page-sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://bankaiinfotech.com/</loc></url>
  <url><loc>https://bankaiinfotech.com/contact-us/</loc></url>
  <url><loc>https://bankaiinfotech.com/resources/</loc></url>
</urlset>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/bankaiinfotech/provider.js')
  } catch {
    assert.fail('Expected Bankai Infotech provider module at ../../scraper/bankaiinfotech/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/bankaiinfotech/script.js')
  } catch {
    assert.fail('Expected Bankai Infotech scraper module at ../../scraper/bankaiinfotech/script.js')
  }
}

test('Bankai Infotech exports the verified fail-closed no-public-careers contract', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'bankaiinfotech',
    companyName: 'Bankai Infotech',
    officialBrandName: 'Bankai Infotech Private Limited',
    adapter: 'script',
    modulePath: '../../scraper/bankaiinfotech/script.js',
    homepageUrl: 'https://bankaiinfotech.com/',
    companyCareerPage: 'https://bankaiinfotech.com/contact-us/',
    atsPlatform: 'official-company-site-no-public-careers',
    countryFilter: 'India',
    paginationStrategy: 'homepage-plus-contact-page-plus-page-sitemap-validation',
    extractionStrategy: 'verified-homepage+verified-contact-page+verified-page-sitemap-without-careers-route+fail-closed-sentinel',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'bankaiinfotech.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://bankaiinfotech.com/ remained the live first-party homepage, that https://bankaiinfotech.com/contact-us/ remained the first-party contact route, and that https://bankaiinfotech.com/page-sitemap.xml published product and resource pages but no official careers, jobs, join-us, or work-with-us route. There is no trustworthy public first-party jobs surface for Bankai Infotech on the verified date, so this provider remains fail-closed.',
    dryRunFile: 'bankaiinfotech/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.HOMEPAGE_URL, providerModule.provider.homepageUrl)
  assert.equal(scriptModule.CONTACT_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)

  const report = generateCompanyCoverageReport({
    csvText: 'Bankai Infotech\n',
    catalog: [providerModule.provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Bankai Infotech returns [] while the first-party site still has no public careers route', async () => {
  const bankai = await loadScriptModule()

  assert.equal(bankai.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(bankai.hasOfficialContactPageSignal(contactHtml), true)
  assert.equal(bankai.hasPageSitemapIndexSignal(sitemapIndexXml), true)
  assert.equal(bankai.hasExpectedPageSitemapSurface(pageSitemapXml), true)
  assert.equal(bankai.hasCareersLikeRoute(pageSitemapXml), false)

  const jobs = await bankai.run({
    fetchText: async (url) => {
      if (url === bankai.HOMEPAGE_URL) return homepageHtml
      if (url === bankai.CONTACT_URL) return contactHtml
      if (url === bankai.SITEMAP_INDEX_URL) return sitemapIndexXml
      if (url === bankai.PAGE_SITEMAP_URL) return pageSitemapXml
      throw new Error(`Unexpected Bankai URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Bankai Infotech fails closed when a careers-like route appears in the first-party sitemap', async () => {
  const bankai = await loadScriptModule()

  await assert.rejects(
    bankai.run({
      fetchText: async (url) => {
        if (url === bankai.HOMEPAGE_URL) return homepageHtml
        if (url === bankai.CONTACT_URL) return contactHtml
        if (url === bankai.SITEMAP_INDEX_URL) return sitemapIndexXml
        if (url === bankai.PAGE_SITEMAP_URL) {
          return `
            <?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://bankaiinfotech.com/</loc></url>
              <url><loc>https://bankaiinfotech.com/contact-us/</loc></url>
              <url><loc>https://bankaiinfotech.com/careers/</loc></url>
            </urlset>
          `
        }

        throw new Error(`Unexpected Bankai URL: ${url}`)
      },
    }),
    /public jobs surface changed materially/i,
  )
})

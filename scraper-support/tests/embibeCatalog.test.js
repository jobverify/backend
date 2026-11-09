import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/embibe/catalog.js')
  } catch {
    assert.fail('Expected Embibe catalog module at ../../scraper/embibe/catalog.js')
  }
}

const loadEmbibeModule = async () => {
  try {
    return await import('../../scraper/embibe/script.js')
  } catch {
    assert.fail('Expected Embibe scraper module at ../../scraper/embibe/script.js')
  }
}

test('Embibe local catalog captures the verified first-party join-us page and browser-session Darwinbox API without aliases', async () => {
  const { EMBIBE_CATALOG } = await loadCatalogModule()
  const embibe = await loadEmbibeModule()
  const provider = hydrateProviderCatalogEntry(EMBIBE_CATALOG)

  assert.equal(provider.source, 'embibe')
  assert.equal(provider.companyName, 'Embibe')
  assert.equal(provider.officialBrandName, 'Indiavidual Learning Limited (Embibe)')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /embibe[\\/]script\.js$/i)
  assert.equal(provider.rootUrl, 'https://www.embibe.com/')
  assert.equal(provider.rootCareersRouteUrl, 'https://www.embibe.com/careers')
  assert.equal(provider.homepageUrl, 'https://www.embibe.com/in-en/home/')
  assert.equal(provider.contactPageUrl, 'https://www.embibe.com/in-en/contactus/')
  assert.equal(provider.companyCareerPage, 'https://www.embibe.com/in-en/joinus/')
  assert.equal(provider.joinUsApiUrl, 'https://www.embibe.com/in-en/wp-json/wp/v2/pages/483')
  assert.equal(provider.sitemapIndexUrl, 'https://www.embibe.com/in-en/sitemap_index.xml')
  assert.equal(provider.pageSitemapUrl, 'https://www.embibe.com/in-en/page-sitemap.xml')
  assert.equal(provider.officialCareersHandoffUrl, 'https://embibe.darwinbox.in/ms/candidate/careers')
  assert.equal(provider.darwinboxOrigin, 'https://embibe.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.publicAllJobsUrl, 'https://embibe.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(provider.companyDomain, 'embibe.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-join-us-page-plus-browser-session-darwinbox-pagination',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-root-shell+verified-root-careers-shell+verified-marketing-homepage+verified-contact-page+verified-join-us-page+verified-join-us-api+verified-sitemap-surfaces+browser-session-darwinbox-listing-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.embibe\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 404/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.embibe\.com\/in-en\/joinus\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.embibe\.com\/in-en\/wp-json\/wp\/v2\/pages\/483/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/embibe\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i)
  assert.match(provider.verifiedSurfaceSummary, /candidateapi\/job\/alljobs\?companyId=main/i)
  assert.match(provider.verifiedSurfaceSummary, /job_counts 0/i)
  assert.match(provider.verifiedSurfaceSummary, /openings appear later/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Embibe'), false)

  assert.equal(embibe.PROVIDER_METADATA.source, EMBIBE_CATALOG.source)
  assert.equal(embibe.PROVIDER_METADATA.companyName, EMBIBE_CATALOG.companyName)
  assert.equal(embibe.PROVIDER_METADATA.companyCareerPage, EMBIBE_CATALOG.companyCareerPage)
  assert.equal(embibe.DARWINBOX_ORIGIN, provider.darwinboxOrigin)
  assert.equal(embibe.PUBLIC_ALL_JOBS_URL, provider.publicAllJobsUrl)
})

test('Embibe backlog row matches directly from local provider metadata without alias churn', async () => {
  const { EMBIBE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Embibe\n',
    catalog: [hydrateProviderCatalogEntry(EMBIBE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Embibe', 'embibe', 'Embibe']],
  )
})

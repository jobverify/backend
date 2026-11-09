import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const celkonModulePath = path.resolve(currentDir, '../../scraper/celkon/script.js')

const loadCatalog = async () => {
  try {
    return await import('../../scraper/celkon/catalog.js')
  } catch {
    assert.fail('Expected Celkon catalog module at ../../scraper/celkon/catalog.js')
  }
}

const loadCelkonModule = async () => {
  try {
    return await import('../../scraper/celkon/script.js')
  } catch {
    assert.fail('Expected Celkon scraper module at ../../scraper/celkon/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath: celkonModulePath,
})

test('getScraperCatalog includes Celkon as a verified no-public-careers sentinel', async () => {
  const { CELKON_CATALOG } = await loadCatalog()
  const celkon = await loadCelkonModule()
  const expectedProvider = buildCatalogReadyProvider(CELKON_CATALOG)
  const provider = getScraperCatalog().find((item) => item.source === 'celkon')

  assert.ok(provider)
  assert.equal(provider.source, 'celkon')
  assert.equal(provider.companyName, 'Celkon')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'legacy-domain-redirect-plus-homepage-about-contact-sitemap-and-common-careers-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-legacy-domain-redirect+verified-homepage+verified-about+verified-contact+verified-page-sitemap-without-careers+verified-common-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyCareerPage, 'https://celkongroup.com/')
  assert.equal(provider.companyDomain, 'celkongroup.com')
  assert.equal(provider.legacyCompanyDomain, 'celkonmobiles.com')
  assert.equal(provider.legacyHomepageUrl, 'https://www.celkonmobiles.com/')
  assert.equal(provider.aboutPageUrl, 'https://celkongroup.com/about-us/')
  assert.equal(provider.contactPageUrl, 'https://celkongroup.com/contacts/')
  assert.equal(provider.pageSitemapUrl, 'https://celkongroup.com/wp-sitemap-posts-page-1.xml')
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.verifiedSurfaceSummary, /celkonmobiles\.com.*redirects to celkongroup\.com/i)
  assert.match(provider.modulePath, /celkon[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /celkon[\\/]jobs\.json$/i)

  assert.equal(expectedProvider.source, provider.source)
  assert.equal(expectedProvider.companyName, provider.companyName)
  assert.equal(expectedProvider.companyCareerPage, provider.companyCareerPage)
  assert.equal(expectedProvider.companyDomain, provider.companyDomain)
  assert.equal(celkon.PROVIDER_METADATA.source, provider.source)
  assert.equal(celkon.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(celkon.PROVIDER_METADATA.pageSitemapUrl, provider.pageSitemapUrl)
})

test('buildScrapers and company coverage resolve Celkon from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'celkon')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'celkon')
  assert.match(scraper.dryRunFile, /celkon[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Celkon,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'celkon')
  assert.equal(report.matched[0].provider?.companyName, 'Celkon')
})

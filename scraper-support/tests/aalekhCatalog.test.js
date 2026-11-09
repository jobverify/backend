import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const aalekhModulePath = path.resolve(currentDir, '../../scraper/aalekh/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aalekh/catalog.js')
  } catch {
    assert.fail('Expected Aalekh catalog module at ../../scraper/aalekh/catalog.js')
  }
}

const loadAalekhModule = async () => {
  try {
    return await import('../../scraper/aalekh/script.js')
  } catch {
    assert.fail('Expected Aalekh scraper module at ../../scraper/aalekh/script.js')
  }
}

test('Aalekh local catalog captures the verified first-party no-public-careers surface', async () => {
  const { AALEKH_CATALOG } = await loadCatalogModule()
  const aalekh = await loadAalekhModule()

  assert.equal(AALEKH_CATALOG.source, 'aalekh')
  assert.equal(AALEKH_CATALOG.companyName, 'Aalekh')
  assert.equal(AALEKH_CATALOG.officialBrandName, 'Aalekh Designs')
  assert.equal(AALEKH_CATALOG.adapter, 'script')
  assert.equal(AALEKH_CATALOG.companyCareerPage, 'https://aalekh.co/')
  assert.equal(AALEKH_CATALOG.companyDomain, 'aalekh.co')
  assert.equal(AALEKH_CATALOG.contactPageUrl, 'https://aalekh.co/contactUs')
  assert.equal(AALEKH_CATALOG.robotsTxtUrl, 'https://aalekh.co/robots.txt')
  assert.equal(AALEKH_CATALOG.sitemapUrl, 'https://aalekh.co/sitemap.xml')
  assert.equal(AALEKH_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(AALEKH_CATALOG.countryFilter, 'India')
  assert.equal(
    AALEKH_CATALOG.paginationStrategy,
    'homepage-plus-contact-plus-common-careers-and-crawl-surface-404-validation',
  )
  assert.equal(
    AALEKH_CATALOG.extractionStrategy,
    'verified-homepage+verified-contact-page+verified-missing-robots-sitemap-and-careers-routes-return-empty',
  )
  assert.equal(AALEKH_CATALOG.parser, 'custom-script')
  assert.equal(AALEKH_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AALEKH_CATALOG.verifiedOn, '2026-07-14')
  assert.match(AALEKH_CATALOG.verifiedSurfaceSummary, /aalekh\.co/i)
  assert.match(AALEKH_CATALOG.verifiedSurfaceSummary, /Aalekh Designs/i)
  assert.match(AALEKH_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(AALEKH_CATALOG.modulePath, aalekhModulePath)

  assert.equal(aalekh.PROVIDER_METADATA.source, AALEKH_CATALOG.source)
  assert.equal(aalekh.PROVIDER_METADATA.companyName, AALEKH_CATALOG.companyName)
  assert.equal(aalekh.PROVIDER_METADATA.companyCareerPage, AALEKH_CATALOG.companyCareerPage)
  assert.equal(aalekh.PROVIDER_METADATA.contactPageUrl, AALEKH_CATALOG.contactPageUrl)
  assert.equal(aalekh.PROVIDER_METADATA.sitemapUrl, AALEKH_CATALOG.sitemapUrl)
})

test('buildScrapers and company coverage resolve Aalekh from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aalekh')
  const scraper = buildScrapers().find((item) => item.name === 'aalekh')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aalekh')
  assert.equal(provider.companyCareerPage, 'https://aalekh.co/')
  assert.match(scraper.dryRunFile, /aalekh[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aalekh\nAalekh Designs\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Aalekh', 'aalekh', 'Aalekh'],
      ['Aalekh Designs', 'aalekh', 'Aalekh'],
    ],
  )
})

import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/belzabar/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/belzabar/catalog.js')
  } catch {
    assert.fail('Expected Belzabar catalog module at ../../scraper/belzabar/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/belzabar/script.js')
  } catch {
    assert.fail('Expected Belzabar scraper module at ../../scraper/belzabar/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Belzabar local catalog captures the verified first-party jobs surface', async () => {
  const { BELZABAR_CATALOG } = await loadCatalogModule()
  const belzabar = await loadScraperModule()
  const provider = buildCatalogReadyProvider(BELZABAR_CATALOG)

  assert.equal(provider.source, 'belzabar')
  assert.equal(provider.companyName, 'Belzabar')
  assert.equal(provider.officialBrandName, 'Belzabar Software Design India Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.belzabar.com/about/life-at-belzabar')
  assert.equal(provider.homepageUrl, 'https://www.belzabar.com/')
  assert.equal(
    provider.homepageLinkedCareersUrl,
    'https://www.belzabar.com/about/life-at-belzabar#careers-section',
  )
  assert.equal(
    provider.canonicalCareersUrl,
    'https://www.belzabar.com/about/life-at-belzabar',
  )
  assert.equal(provider.companyDomain, 'belzabar.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-link-plus-canonical-careers-page-and-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-canonical-careers-page+same-domain-job-detail-pages+same-page-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.belzabar\.com\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.belzabar\.com\/about\/life-at-belzabar#careers-section/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.belzabar\.com\/about\/life-at-belzabar/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.belzabar\.com\/jobs\/qa-engineer/i,
  )
  assert.doesNotMatch(provider.verifiedSurfaceSummary, /\b502 Proxy Error\b/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /belzabar[\\/]jobs\.json$/i)

  assert.equal(belzabar.PROVIDER_METADATA.source, provider.source)
  assert.equal(belzabar.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(belzabar.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    belzabar.PROVIDER_METADATA.homepageLinkedCareersUrl,
    provider.homepageLinkedCareersUrl,
  )
  assert.equal(
    belzabar.PROVIDER_METADATA.canonicalCareersUrl,
    provider.canonicalCareersUrl,
  )
})

test('Belzabar exact backlog name matches from the local provider contract without aliases', async () => {
  const { BELZABAR_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Belzabar\n',
    catalog: [buildCatalogReadyProvider(BELZABAR_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Belzabar', 'belzabar', 'Belzabar']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Belzabar'), false)
})

test('buildScrapers and company coverage resolve Belzabar from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'belzabar')
  const scraper = buildScrapers().find((item) => item.name === 'belzabar')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Belzabar')
  assert.equal(provider.companyCareerPage, 'https://www.belzabar.com/about/life-at-belzabar')
  assert.match(scraper.dryRunFile, /belzabar[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Belzabar\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Belzabar', 'belzabar', 'Belzabar']],
  )
})

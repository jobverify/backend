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
const modulePath = path.resolve(currentDir, '../../scraper/assochamtech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/assochamtech/catalog.js')
  } catch {
    assert.fail('Expected Assocham Tech catalog module at ../../scraper/assochamtech/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/assochamtech/script.js')
  } catch {
    assert.fail('Expected Assocham Tech scraper module at ../../scraper/assochamtech/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Assocham Tech local catalog captures the verified first-party ASSOCHAM intake-only careers surface', async () => {
  const { ASSOCHAM_TECH_CATALOG } = await loadCatalogModule()
  const assochamTech = await loadScraperModule()
  const provider = buildCatalogReadyProvider(ASSOCHAM_TECH_CATALOG)

  assert.equal(provider.source, 'assochamtech')
  assert.equal(provider.companyName, 'Assocham Tech')
  assert.equal(provider.officialBrandName, 'ASSOCHAM')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.assocham.org/')
  assert.equal(provider.companyCareerPage, 'https://www.assocham.org/assocham_backend/career.php')
  assert.equal(provider.legacyCareersUrl, 'https://www.assocham.org/career.php')
  assert.equal(provider.applicationEmail, 'hr@assocham.com')
  assert.equal(provider.applicationUrl, 'mailto:hr@assocham.com')
  assert.equal(provider.companyDomain, 'assocham.org')
  assert.equal(
    provider.atsPlatform,
    'official-company-site-no-public-careers',
  )
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-generic-careers-intake-page-plus-common-job-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-generic-careers-intake-page-without-public-listings+verified-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.dryRunFile, /assochamtech[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.assocham\.org\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.assocham\.org\/career\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /hr@assocham\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(assochamTech.PROVIDER_METADATA.source, provider.source)
  assert.equal(assochamTech.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(
    assochamTech.PROVIDER_METADATA.companyCareerPage,
    provider.companyCareerPage,
  )
  assert.equal(
    assochamTech.PROVIDER_METADATA.applicationEmail,
    provider.applicationEmail,
  )
})

test('Assocham Tech exact backlog name matches from the local provider contract without aliases', async () => {
  const { ASSOCHAM_TECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Assocham Tech\n',
    catalog: [buildCatalogReadyProvider(ASSOCHAM_TECH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Assocham Tech', 'assochamtech', 'Assocham Tech']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Assocham Tech'), false)
})

test('buildScrapers and company coverage resolve Assocham Tech from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'assochamtech')
  const scraper = buildScrapers().find((item) => item.name === 'assochamtech')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Assocham Tech')
  assert.equal(provider.companyCareerPage, 'https://www.assocham.org/assocham_backend/career.php')
  assert.match(scraper.dryRunFile, /assochamtech[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Assocham Tech\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Assocham Tech', 'assochamtech', 'Assocham Tech']],
  )
})

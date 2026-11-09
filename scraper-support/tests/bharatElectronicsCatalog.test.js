import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bharatelectronics/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bharatelectronics/catalog.js')
  } catch {
    assert.fail('Expected Bharat Electronics catalog module at ../../scraper/bharatelectronics/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/bharatelectronics/script.js')
  } catch {
    assert.fail('Expected Bharat Electronics scraper module at ../../scraper/bharatelectronics/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Bharat Electronics local catalog captures the verified first-party job notifications surface', async () => {
  const { BHARAT_ELECTRONICS_CATALOG } = await loadCatalogModule()
  const bharatElectronics = await loadScraperModule()
  const provider = buildCatalogReadyProvider(BHARAT_ELECTRONICS_CATALOG)

  assert.equal(provider.source, 'bharatelectronics')
  assert.equal(provider.companyName, 'Bharat Electronics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://bel-india.in/job-notifications/')
  assert.equal(provider.homepageUrl, 'https://bel-india.in/')
  assert.equal(provider.pageTwoUrl, 'https://bel-india.in/job-notifications/page/2/')
  assert.equal(provider.sampleOnlineApplyUrl, 'https://jobapply.in/BEL2026PuneHavildarSecurity/')
  assert.equal(
    provider.sampleApplicationFormUrl,
    'https://bel-india.in/wp-content/uploads/2026/06/BIO-DATA-FORM.pdf',
  )
  assert.equal(provider.companyDomain, 'bel-india.in')
  assert.equal(provider.atsPlatform, 'first-party-recruitment-notices-plus-jobapply-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'job-notifications-root-plus-page-number-dedupe-stop')
  assert.equal(
    provider.extractionStrategy,
    'official-homepage+official-job-notifications-listings+active-date-filter+jobapply-and-pdf-application-handoffs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /bharatelectronics[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bel-india\.in\/job-notifications\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobapply\.in\/BEL2026PuneHavildarSecurity\//i)
  assert.match(provider.verifiedSurfaceSummary, /BIO-DATA-FORM\.pdf/i)
  assert.match(provider.verifiedSurfaceSummary, /31-07-2026/i)
  assert.match(provider.verifiedSurfaceSummary, /16-07-2026/i)

  assert.equal(bharatElectronics.PROVIDER_METADATA.source, provider.source)
  assert.equal(bharatElectronics.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(bharatElectronics.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Bharat Electronics backlog row matches directly from local provider metadata without aliases', async () => {
  const { BHARAT_ELECTRONICS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Bharat Electronics\n',
    catalog: [buildCatalogReadyProvider(BHARAT_ELECTRONICS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bharat Electronics', 'bharatelectronics', 'Bharat Electronics']],
  )
})

test('buildScrapers and company coverage resolve Bharat Electronics from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bharatelectronics')
  const scraper = buildScrapers().find((item) => item.name === 'bharatelectronics')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Bharat Electronics')
  assert.equal(provider.companyCareerPage, 'https://bel-india.in/job-notifications/')
  assert.match(scraper.dryRunFile, /bharatelectronics[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Bharat Electronics\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bharat Electronics', 'bharatelectronics', 'Bharat Electronics']],
  )
})

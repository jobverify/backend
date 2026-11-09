import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAkhilSystemsCatalog = async () => {
  try {
    return await import('../../scraper/akhilsystems/catalog.js')
  } catch {
    assert.fail('Expected Akhil Systems catalog module at ../../scraper/akhilsystems/catalog.js')
  }
}

test('Akhil Systems catalog captures the verified first-party careers surface metadata', async () => {
  const {
    AKHIL_SYSTEMS_CATALOG,
    default: defaultCatalog,
  } = await loadAkhilSystemsCatalog()

  assert.equal(defaultCatalog, AKHIL_SYSTEMS_CATALOG)
  assert.equal(AKHIL_SYSTEMS_CATALOG.source, 'akhilsystems')
  assert.equal(AKHIL_SYSTEMS_CATALOG.companyName, 'Akhil Systems')
  assert.equal(AKHIL_SYSTEMS_CATALOG.legalEntityName, 'Akhil Systems Pvt. Ltd.')
  assert.equal(AKHIL_SYSTEMS_CATALOG.adapter, 'script')
  assert.equal(AKHIL_SYSTEMS_CATALOG.companyCareerPage, 'https://akhilsystems.com/OurCareer/')
  assert.equal(AKHIL_SYSTEMS_CATALOG.companyDomain, 'akhilsystems.com')
  assert.equal(AKHIL_SYSTEMS_CATALOG.officialHomepageUrl, 'https://akhilsystems.com/')
  assert.equal(
    AKHIL_SYSTEMS_CATALOG.officialHomepageCareerUrl,
    'https://akhilsystems.com/OurCareer/',
  )
  assert.equal(
    AKHIL_SYSTEMS_CATALOG.canonicalCareersUrl,
    'https://akhilsystems.com/OurCareer/',
  )
  assert.equal(AKHIL_SYSTEMS_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(AKHIL_SYSTEMS_CATALOG.countryFilter, 'India')
  assert.equal(
    AKHIL_SYSTEMS_CATALOG.paginationStrategy,
    'single-first-party-careers-page-inline-job-cards',
  )
  assert.equal(
    AKHIL_SYSTEMS_CATALOG.extractionStrategy,
    'verified-homepage-career-link+verified-canonical-careers-page+inline-first-party-job-cards',
  )
  assert.equal(AKHIL_SYSTEMS_CATALOG.parser, 'custom-script')
  assert.equal(AKHIL_SYSTEMS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AKHIL_SYSTEMS_CATALOG.verifiedOn, '2026-07-19')
  assert.match(AKHIL_SYSTEMS_CATALOG.verifiedSurfaceSummary, /https:\/\/akhilsystems\.com\//i)
  assert.match(
    AKHIL_SYSTEMS_CATALOG.verifiedSurfaceSummary,
    /https:\/\/akhilsystems\.com\/OurCareer\/?/i,
  )
  assert.doesNotMatch(AKHIL_SYSTEMS_CATALOG.verifiedSurfaceSummary, /https:\/\/akhilsystems\.com\/careers\/?/i)
  assert.match(AKHIL_SYSTEMS_CATALOG.verifiedSurfaceSummary, /India roles/i)
  assert.match(AKHIL_SYSTEMS_CATALOG.modulePath, /akhilsystems[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Akhil Systems'), false)
})

test('Akhil Systems backlog matching works directly from the local catalog metadata', async () => {
  const { AKHIL_SYSTEMS_CATALOG } = await loadAkhilSystemsCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Akhil Systems\n',
    catalog: [AKHIL_SYSTEMS_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akhil Systems', 'akhilsystems', 'Akhil Systems']],
  )
})

test('buildScrapers and company coverage resolve Akhil Systems from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'akhilsystems')
  const scraper = buildScrapers().find((item) => item.name === 'akhilsystems')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Akhil Systems')
  assert.equal(provider.companyCareerPage, 'https://akhilsystems.com/careers/')
  assert.match(scraper.dryRunFile, /akhilsystems[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Akhil Systems\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akhil Systems', 'akhilsystems', 'Akhil Systems']],
  )
})

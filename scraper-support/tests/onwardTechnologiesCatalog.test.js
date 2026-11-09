import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const onwardTechnologiesModulePath = path.resolve(currentDir, '../../scraper/onwardtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/onwardtechnologies/catalog.js')
  } catch {
    assert.fail('Expected Onward Technologies catalog module at ../../scraper/onwardtechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/onwardtechnologies/script.js')
  } catch {
    assert.fail('Expected Onward Technologies scraper module at ../../scraper/onwardtechnologies/script.js')
  }
}

test('Onward Technologies local catalog captures the verified first-party India openings surface', async () => {
  const { ONWARD_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const onwardTechnologies = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(ONWARD_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'onwardtechnologies')
  assert.equal(provider.companyName, 'Onward Technologies')
  assert.equal(provider.officialBrandName, 'Onward Tech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.onwardgroup.com/')
  assert.equal(provider.companyCareerPage, 'https://www.onwardgroup.com/careers.php')
  assert.equal(provider.jobsBoardUrl, 'https://www.onwardgroup.com/careers.php')
  assert.equal(provider.officialResumeSubmissionEmail, 'careers@onwardgroup.com')
  assert.equal(provider.companyDomain, 'onwardgroup.com')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-accordion-listings',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+public-accordion-listings+sucuri-cookie-challenge+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /onwardtechnologies[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, onwardTechnologiesModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.onwardgroup\.com\/careers\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /Embedded - SME \(Validation Automotive\)/i)
  assert.match(provider.verifiedSurfaceSummary, /India Business Delivery Head/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Onward Technologies'), false)

  assert.equal(
    onwardTechnologies.PROVIDER_METADATA.source,
    ONWARD_TECHNOLOGIES_CATALOG.source,
  )
  assert.equal(
    onwardTechnologies.PROVIDER_METADATA.companyCareerPage,
    ONWARD_TECHNOLOGIES_CATALOG.companyCareerPage,
  )
})

test('Onward Technologies backlog row matches directly from the local catalog without alias churn', async () => {
  const { ONWARD_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Onward Technologies\n',
    catalog: [hydrateProviderCatalogEntry(ONWARD_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Onward Technologies', 'onwardtechnologies', 'Onward Technologies']],
  )
})

test('getScraperCatalog exposes Onward Technologies as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'onwardtechnologies')
  const scraper = buildScrapers().find((item) => item.name === 'onwardtechnologies')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Onward Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.onwardgroup.com/careers.php')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Onward Technologies'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Onward Technologies\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Onward Technologies', 'onwardtechnologies', 'Onward Technologies']],
  )
})

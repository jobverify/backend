import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const innovisionModulePath = path.resolve(currentDir, '../../scraper/innovision/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/innovision/catalog.js')
  } catch {
    assert.fail('Expected Innovision catalog module at ../../scraper/innovision/catalog.js')
  }
}

const loadInnovisionModule = async () => {
  try {
    return await import('../../scraper/innovision/script.js')
  } catch {
    assert.fail('Expected Innovision scraper module at ../../scraper/innovision/script.js')
  }
}

test('Innovision local catalog captures the verified first-party inline openings surface', async () => {
  const { INNOVISION_CATALOG } = await loadCatalogModule()
  const innovision = await loadInnovisionModule()

  assert.equal(INNOVISION_CATALOG.source, 'innovision')
  assert.equal(INNOVISION_CATALOG.companyName, 'Innovision')
  assert.equal(INNOVISION_CATALOG.officialBrandName, 'Innovision Limited')
  assert.equal(INNOVISION_CATALOG.adapter, 'script')
  assert.equal(INNOVISION_CATALOG.companyCareerPage, 'https://www.innovision.co.in/careers/')
  assert.equal(INNOVISION_CATALOG.homepageUrl, 'https://www.innovision.co.in/')
  assert.equal(INNOVISION_CATALOG.applicationUrl, 'mailto:careers@innovision.co.in')
  assert.equal(INNOVISION_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(INNOVISION_CATALOG.countryFilter, 'India')
  assert.equal(INNOVISION_CATALOG.paginationStrategy, 'verified-first-party-careers-page-inline-openings')
  assert.equal(
    INNOVISION_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+inline-opening-cards+shared-email-apply-surface',
  )
  assert.equal(INNOVISION_CATALOG.parser, 'custom-script')
  assert.equal(INNOVISION_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INNOVISION_CATALOG.companyDomain, 'innovision.co.in')
  assert.equal(INNOVISION_CATALOG.verifiedOn, '2026-07-16')
  assert.match(INNOVISION_CATALOG.dryRunFile, /innovision[\\/]jobs\.json$/i)
  assert.match(INNOVISION_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.innovision\.co\.in\/careers\//i)
  assert.match(INNOVISION_CATALOG.verifiedSurfaceSummary, /Security Supervisor/i)
  assert.match(INNOVISION_CATALOG.verifiedSurfaceSummary, /Training & Development Officer/i)
  assert.match(INNOVISION_CATALOG.verifiedSurfaceSummary, /careers@innovision\.co\.in/i)
  assert.equal(INNOVISION_CATALOG.modulePath, innovisionModulePath)

  assert.equal(innovision.PROVIDER_METADATA.source, INNOVISION_CATALOG.source)
  assert.equal(innovision.PROVIDER_METADATA.companyName, INNOVISION_CATALOG.companyName)
  assert.equal(innovision.PROVIDER_METADATA.applicationUrl, INNOVISION_CATALOG.applicationUrl)
})

test('Innovision backlog row matches directly from the local catalog without alias churn', async () => {
  const { INNOVISION_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Innovision\n',
    catalog: [INNOVISION_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Innovision', 'innovision', 'Innovision']],
  )
})

test('getScraperCatalog includes Innovision as a verified first-party inline openings provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'innovision')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Innovision')
  assert.equal(provider.companyCareerPage, 'https://www.innovision.co.in/careers/')
  assert.equal(provider.companyDomain, 'innovision.co.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /innovision[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Innovision scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'innovision')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'innovision')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /innovision[\\/]jobs\.json$/i)
})

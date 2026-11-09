import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/centralboardofirrigationandpower/provider.js')
  } catch {
    return null
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/centralboardofirrigationandpower/script.js')
  } catch {
    assert.fail('Expected Central Board of Irrigation and Power scraper module at ../../scraper/centralboardofirrigationandpower/script.js')
  }
}

test('getScraperCatalog includes Central Board of Irrigation and Power as a verified first-party sentinel', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.ok(
    providerModule,
    'Expected Central Board of Irrigation and Power provider module at ../../scraper/centralboardofirrigationandpower/provider.js',
  )

  const provider = getScraperCatalog().find((item) => item.source === 'centralboardofirrigationandpower')

  assert.ok(provider)
  assert.equal(provider.source, 'centralboardofirrigationandpower')
  assert.equal(provider.companyName, 'Central Board of Irrigation and Power')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /centralboardofirrigationandpower[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://cbip.org/')
  assert.equal(provider.atsPlatform, 'official-company-homepage')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-recruitment-placeholder')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-empty-recruitment-notice+employee-login-only-hrms-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cbip.org')
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /Recruitment Notice/i)
  assert.match(provider.verifiedSurfaceSummary, /Employee Login/i)
  assert.match(provider.verifiedSurfaceSummary, /HRMS/i)
  assert.match(provider.dryRunFile, /centralboardofirrigationandpower[\\/]jobs\.json$/i)

  assert.equal(providerModule.provider.source, provider.source)
  assert.equal(providerModule.provider.companyName, provider.companyName)
  assert.equal(providerModule.provider.companyCareerPage, provider.companyCareerPage)
  assert.equal(scriptModule.SOURCE, provider.source)
  assert.equal(scriptModule.COMPANY, provider.companyName)
})

test('buildScrapers and company coverage resolve Central Board of Irrigation and Power from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'centralboardofirrigationandpower')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'centralboardofirrigationandpower')
  assert.match(scraper.dryRunFile, /centralboardofirrigationandpower[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Central Board of Irrigation and Power,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Central Board of Irrigation and Power', 'centralboardofirrigationandpower', 'Central Board of Irrigation and Power']],
  )
})

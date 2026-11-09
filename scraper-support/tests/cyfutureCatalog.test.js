import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/cyfuture/provider.js')
  } catch {
    assert.fail('Expected Cyfuture provider module at ../../scraper/cyfuture/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cyfuture/script.js')
  } catch {
    assert.fail('Expected Cyfuture scraper module at ../../scraper/cyfuture/script.js')
  }
}

test('getScraperCatalog includes Cyfuture as a verified first-party careers scraper', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()
  const provider = getScraperCatalog().find((item) => item.source === 'cyfuture')

  assert.ok(provider)
  assert.equal(provider.source, 'cyfuture')
  assert.equal(provider.companyName, 'Cyfuture')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /cyfuture[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://cyfuture.com/current-opportunities.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'paired-native-location-tabs-and-declared-office-role-pages;company-scope-unqualified')
  assert.equal(
    provider.extractionStrategy,
    'whole-native-role-criteria+same-publisher-office-country-group-binding+paired-closing-models',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cyfuture.com')
  assert.equal(provider.verifiedOn, '2026-11-05')
  assert.match(provider.verifiedSurfaceSummary, /current-opportunities\.html/i)
  assert.match(provider.dryRunFile, /cyfuture[\\/]jobs\.json$/i)

  assert.equal(providerModule.provider.source, provider.source)
  assert.equal(providerModule.provider.companyName, provider.companyName)
  assert.equal(providerModule.provider.companyCareerPage, provider.companyCareerPage)
  assert.equal(providerModule.provider.companyDomain, provider.companyDomain)
  assert.equal(scriptModule.SOURCE, provider.source)
  assert.equal(scriptModule.COMPANY, provider.companyName)
  assert.equal(scriptModule.CURRENT_OPPORTUNITIES_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Cyfuture from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cyfuture')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cyfuture')
  assert.match(scraper.dryRunFile, /cyfuture[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Cyfuture,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Cyfuture', 'cyfuture', 'Cyfuture']],
  )
})

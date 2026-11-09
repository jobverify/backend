import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/aaravsolutions/provider.js')
  } catch {
    assert.fail('Expected Aarav Solutions provider module at ../../scraper/aaravsolutions/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/aaravsolutions/script.js')
  } catch {
    assert.fail('Expected Aarav Solutions scraper module at ../../scraper/aaravsolutions/script.js')
  }
}

test('Aarav Solutions exports a local provider descriptor for the verified first-party careers scraper', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()
  const provider = providerModule.provider

  assert.ok(provider, 'Expected Aarav Solutions provider export')
  assert.equal(provider.source, 'aaravsolutions')
  assert.equal(provider.companyName, 'Aarav Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, '../../scraper/aaravsolutions/script.js')
  assert.equal(provider.companyCareerPage, 'https://www.aaravsolutions.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-shared-hubspot-apply-form')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+inline-india-job-cards+shared-first-party-hubspot-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aaravsolutions.com')
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /hubspot/i)
  assert.match(provider.verifiedSurfaceSummary, /india roles/i)

  assert.equal(scriptModule.SOURCE, provider.source)
  assert.equal(scriptModule.COMPANY, provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Aarav Solutions from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aaravsolutions')
  const scraper = buildScrapers().find((item) => item.name === 'aaravsolutions')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aarav Solutions')
  assert.equal(provider.companyCareerPage, 'https://www.aaravsolutions.com/careers/')
  assert.match(scraper.dryRunFile, /aaravsolutions[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aarav Solutions\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aarav Solutions', 'aaravsolutions', 'Aarav Solutions']],
  )
})

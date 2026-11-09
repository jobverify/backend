import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/aandbglobal/provider.js')
  } catch {
    assert.fail('Expected A&B Global provider module at ../../scraper/aandbglobal/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/aandbglobal/script.js')
  } catch {
    assert.fail('Expected A&B Global scraper module at ../../scraper/aandbglobal/script.js')
  }
}

test('A&B Global exports a local provider descriptor for the verified first-party no-public-jobs surface', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()
  const provider = providerModule.provider

  assert.ok(provider, 'Expected A&B Global provider export')
  assert.equal(provider.source, 'aandbglobal')
  assert.equal(provider.companyName, 'A&B Global')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, '../../scraper/aandbglobal/script.js')
  assert.equal(provider.companyCareerPage, 'https://aandbglobal.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-work-with-us-anchor-plus-sitemap-plus-common-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-work-with-us-partner-popup+verified-single-homepage-sitemap+missing-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aandbglobal.com')
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.verifiedSurfaceSummary, /join with us as a partner/i)

  assert.equal(scriptModule.SOURCE, provider.source)
  assert.equal(scriptModule.COMPANY, provider.companyName)
  assert.equal(scriptModule.HOMEPAGE_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve A&B Global from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aandbglobal')
  const scraper = buildScrapers().find((item) => item.name === 'aandbglobal')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'A&B Global')
  assert.equal(provider.companyCareerPage, 'https://aandbglobal.com/')
  assert.match(scraper.dryRunFile, /aandbglobal[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'A&B Global\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['A&B Global', 'aandbglobal', 'A&B Global']],
  )
})

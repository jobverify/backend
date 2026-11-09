import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadWazirXModule = async () => {
  try {
    return await import('../../scraper/wazirx/script.js')
  } catch {
    assert.fail('Expected WazirX scraper module at ../../scraper/wazirx/script.js')
  }
}

test('getScraperCatalog includes WazirX as a verified first-party careers scraper', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wazirx')
  const wazirx = await loadWazirXModule()

  assert.ok(provider)
  assert.equal(provider.source, 'wazirx')
  assert.equal(provider.companyName, 'WazirX')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.wazirx.com/')
  assert.equal(provider.companyDomain, 'careers.wazirx.com')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'first-party-careers-html+first-party-jobs-script')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /wazirx[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /wazirx[\\/]jobs\.json$/i)
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /careers\.wazirx\.com/i)

  assert.equal(wazirx.SOURCE, provider.source)
  assert.equal(wazirx.COMPANY, provider.companyName)
  assert.equal(wazirx.CAREERS_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve WazirX from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'wazirx')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'wazirx')
  assert.match(scraper.dryRunFile, /wazirx[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'WazirX,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['WazirX', 'wazirx', 'WazirX']],
  )
})

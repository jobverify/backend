import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCmcLimitedModule = async () => {
  try {
    return await import('../../scraper/cmclimited/script.js')
  } catch {
    assert.fail('Expected CMC Limited scraper module at ../../scraper/cmclimited/script.js')
  }
}

test('getScraperCatalog includes CMC Limited as a verified post-merger sentinel', async () => {
  const cmcLimited = await loadCmcLimitedModule()
  const provider = getScraperCatalog().find((item) => item.source === cmcLimited.SOURCE)

  assert.ok(provider)
  assert.equal(provider.source, 'cmclimited')
  assert.equal(provider.companyName, 'CMC Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.cmcltd.com/')
  assert.equal(provider.companyDomain, 'cmcltd.com')
  assert.equal(provider.workspaceDomain, 'tcs.com')
  assert.equal(provider.atsPlatform, 'historical-company-domain-plus-parent-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-post-merger-company-domain-plus-parent-careers-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-cmcltd-post-merger-shell+verified-parent-tcs-careers-without-cmc-specific-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /cmclimited[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /cmclimited[\\/]jobs\.json$/i)

  assert.deepEqual(cmcLimited.CATALOG_METADATA, {
    source: 'cmclimited',
    companyName: 'CMC Limited',
    adapter: 'script',
    modulePath: '../../scraper/cmclimited/script.js',
    companyCareerPage: 'https://www.cmcltd.com/',
    atsPlatform: 'historical-company-domain-plus-parent-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'verified-post-merger-company-domain-plus-parent-careers-validation',
    extractionStrategy: 'verified-cmcltd-post-merger-shell+verified-parent-tcs-careers-without-cmc-specific-jobs-return-empty',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'cmcltd.com',
    workspaceDomain: 'tcs.com',
  })
  assert.equal(cmcLimited.SOURCE, provider.source)
  assert.equal(cmcLimited.COMPANY, provider.companyName)
  assert.equal(cmcLimited.CMC_INFO_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve CMC Limited from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cmclimited')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cmclimited')
  assert.match(scraper.dryRunFile, /cmclimited[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'CMC Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CMC Limited', 'cmclimited', 'CMC Limited']],
  )
})

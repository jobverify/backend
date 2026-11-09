import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('HuT Labs is registered against the verified Amrita jobs board surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hutlabs')

  assert.ok(provider, 'Expected HuT Labs provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HuT Labs')
  assert.equal(provider.companyCareerPage, 'https://www.amrita.edu/jobs/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-verified-amrita-jobs-board-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-amrita-jobs-board+hut-labs-title-filter+verified-detail-pages+amrita-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'amrita.edu')
  assert.match(provider.modulePath, /hutlabs[\\/]script\.js$/i)
})

test('HuT Labs matches company coverage directly from provider metadata for the spaced company name', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'HuT Labs\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HuT Labs', 'hutlabs', 'HuT Labs']],
  )
})

test('HuT Labs is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hutlabs')

  assert.ok(scraper, 'Expected buildScrapers() to return the HuT Labs scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hutlabs')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.amrita.edu/jobs/')
  assert.match(scraper.dryRunFile, /hutlabs[\\/]jobs\.json$/i)
})

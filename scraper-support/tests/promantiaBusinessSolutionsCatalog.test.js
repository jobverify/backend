import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('PROMANTIA Business Solutions is registered against the verified first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'promantiabusinesssolutionspvtltd')

  assert.ok(provider, 'Expected PROMANTIA Business Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PROMANTIA Business Solutions Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://promantia.in/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+public-job-blocks+detail-pages+shared-onsite-apply-popup+detail-title-mismatch-fallback',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'promantia.in')
  assert.match(provider.modulePath, /promantiabusinesssolutionspvtltd[\\/]script\.js$/i)
})

test('PROMANTIA Business Solutions matches coverage directly and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'PROMANTIA Business Solutions Pvt. Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'PROMANTIA Business Solutions Pvt. Ltd.',
      'promantiabusinesssolutionspvtltd',
      'PROMANTIA Business Solutions Pvt. Ltd.',
    ]],
  )

  const scraper = buildScrapers().find((item) => item.name === 'promantiabusinesssolutionspvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the PROMANTIA Business Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'promantiabusinesssolutionspvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://promantia.in/career/')
  assert.match(scraper.dryRunFile, /promantiabusinesssolutionspvtltd[\\/]jobs\.json$/i)
})

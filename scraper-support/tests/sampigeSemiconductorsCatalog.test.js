import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Sampige Semiconductors as a verified empty-board script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sampigesemiconductors')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Sampige Semiconductors')
  assert.equal(provider.companyCareerPage, 'https://sampigesemi.com/')
  assert.equal(provider.companyDomain, 'sampigesemi.com')
  assert.equal(provider.paginationStrategy, 'single-official-homepage')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+contact-cta-apply-by-email-zero-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /sampigesemiconductors[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact Sampige Semiconductors name without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sampigesemiconductors')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sampigesemiconductors')
  assert.match(scraper.dryRunFile, /sampigesemiconductors[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Sampige Semiconductors\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Sampige Semiconductors', 'sampigesemiconductors', 'sampigesemiconductors']],
  )
  assert.equal(report.unmatchedCount, 0)
})

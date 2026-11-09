import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Coromandel International as a verified empty-board sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'coromandelinternational')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Coromandel International')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-shell')
  assert.equal(provider.companyCareerPage, 'https://www.coromandel.biz/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-shell')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell+unrendered-awsmjobs-shortcode-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'coromandel.biz')
  assert.match(provider.modulePath, /coromandelinternational[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Coromandel International rows', () => {
  const scraper = buildScrapers().find((item) => item.name === 'coromandelinternational')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /coromandelinternational[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'coromandelinternational')

  const report = generateCompanyCoverageReport({
    csvText: 'Coromandel International,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Coromandel International', 'coromandelinternational', 'Coromandel International']],
  )
})

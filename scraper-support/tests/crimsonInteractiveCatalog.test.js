import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Crimson Interactive as a verified Freshteam source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'crimsoninteractive')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Crimson Interactive')
  assert.equal(provider.companyCareerPage, 'https://crimsoniteam.freshteam.com/jobs')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-opportunities-shell-plus-public-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-opportunities-shell+verified-public-freshteam-board+detail-page-apply-surface',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'crimsoni.com')
  assert.match(provider.modulePath, /crimsoninteractive[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Crimson Interactive rows', () => {
  const scraper = buildScrapers().find((item) => item.name === 'crimsoninteractive')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'crimsoninteractive')
  assert.match(scraper.dryRunFile, /crimsoninteractive[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Crimson Interactive,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Crimson Interactive', 'crimsoninteractive', 'Crimson Interactive']],
  )
})

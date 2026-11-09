import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes LSEG on the verified official careers page backed by the public Workday tenant', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lseg')

  assert.ok(provider, 'Expected LSEG provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'London Stock Exchange Group (LSEG)')
  assert.equal(provider.companyCareerPage, 'https://www.lseg.com/en/careers')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'jobs-api')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+workday-jobs-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lseg.com')
  assert.match(provider.modulePath, /lseg\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable LSEG scraper and exact backlog coverage works without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'lseg')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lseg')
  assert.equal(scraper.provider.atsPlatform, 'workday')
  assert.match(scraper.dryRunFile, /lseg.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'London Stock Exchange Group (LSEG),\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['London Stock Exchange Group (LSEG)', 'lseg', 'London Stock Exchange Group (LSEG)']],
  )
})

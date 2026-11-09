import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Curefoods as a verified LinkedIn-handoff sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'curefoods')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Curefoods')
  assert.equal(provider.companyCareerPage, 'https://www.curefoods.in/pages/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-linkedin-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-careers-page+linkedin-handoff+email-apply-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'curefoods.in')
  assert.match(provider.modulePath, /curefoods[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Curefoods rows', () => {
  const scraper = buildScrapers().find((item) => item.name === 'curefoods')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'curefoods')
  assert.match(scraper.dryRunFile, /curefoods[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Curefoods,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Curefoods', 'curefoods', 'Curefoods']],
  )
})

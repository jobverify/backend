import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Tredence as an official RippleHire-backed script provider with the needed coverage alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tredence')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Tredence')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ripplehire')
  assert.equal(provider.companyCareerPage, 'https://www.tredence.com/careers/greatest-of-ai')
  assert.equal(provider.companyDomain, 'tredence.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-param-on-public-ripplehire-board')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+ripplehire-list-detail-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /tredence[\\/]script\.js$/i)
  assert.equal(companyAliases['Tredence Analytics Solutions'], 'tredence')
})

test('buildScrapers and company coverage resolve Tredence Analytics Solutions to the tredence source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tredence')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tredence[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tredence')
  assert.equal(scraper.provider.atsPlatform, 'ripplehire')

  const report = generateCompanyCoverageReport({
    csvText: 'Tredence Analytics Solutions,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [['Tredence Analytics Solutions', 'tredence', 'Tredence']],
  )
})

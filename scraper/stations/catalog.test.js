import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Station-S is registered as an official-site empty-shell sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'stations')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Station-S')
  assert.equal(provider.companyCareerPage, 'https://station-s.com/careers.php')
  assert.equal(provider.atsPlatform, 'official-company-careers-shell')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'station-s.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /stations[\\/]script\.js$/i)
})

test('Station-S matches the extracted CSV company row directly', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Station-S,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Station-S', 'stations', 'Station-S']],
  )
})

test('Station-S remains runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'stations')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /stations[\\/]jobs\.json$/i)
})

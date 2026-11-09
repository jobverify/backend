import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('WNS-Vuram is registered as a non-listing official careers sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wnsvuram')

  assert.ok(provider, 'Expected WNS-Vuram provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'WNS-Vuram')
  assert.equal(provider.companyCareerPage, 'https://www.vuram.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-shell-validation')
  assert.equal(provider.extractionStrategy, 'verified-official-homepage-plus-nonlisting-careers-shell-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'vuram.com')
  assert.match(provider.modulePath, /wnsvuram[\\/]script\.js$/i)
})

test('WNS Vuram resolves through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'WNS Vuram,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['WNS Vuram', 'wnsvuram', 'WNS-Vuram']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'wnsvuram')

  assert.ok(scraper, 'Expected buildScrapers() to return the WNS-Vuram scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'wnsvuram')
  assert.equal(scraper.provider.companyName, 'WNS-Vuram')
  assert.match(scraper.dryRunFile, /wnsvuram[\\/]jobs\.json$/i)
})

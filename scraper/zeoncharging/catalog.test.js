import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Zeon Charging is registered as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zeoncharging')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Zeon Electric Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://zeoncharging.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'zeoncharging.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /zeoncharging[\\/]script\.js$/i)
})

test('Zeon Electric Private Limited and Zeon Charging resolve to the Zeon careers scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Zeon Electric Private Limited,\nZeon Charging,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Zeon Electric Private Limited', 'zeoncharging', 'Zeon Electric Pvt Ltd'],
      ['Zeon Charging', 'zeoncharging', 'Zeon Electric Pvt Ltd'],
    ],
  )
})

test('Zeon Charging remains runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'zeoncharging')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /zeoncharging[\\/]jobs\.json$/i)
})

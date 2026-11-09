import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Syntacticlogic is registered as an official-site non-listing sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'syntacticlogic')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Syntacticlogic Technology')
  assert.equal(provider.companyCareerPage, 'https://syntacticlogic.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'syntacticlogic.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /syntacticlogic[\\/]script\.js$/i)
})

test('Syntacticlogic matches the extracted CSV company row directly', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Syntacticlogic Technology,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Syntacticlogic Technology', 'syntacticlogic', 'Syntacticlogic Technology']],
  )
})

test('Syntacticlogic remains runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'syntacticlogic')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /syntacticlogic[\\/]jobs\.json$/i)
})

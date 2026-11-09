import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Vimaana Aerospace Technologies is registered as a first-party careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vimaanaaerospacetechnologies')

  assert.ok(provider, 'Expected Vimaana Aerospace Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Vimaana Aerospace Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.vimaanatech.com/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-wix-page-data')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+wix-page-data-role-cards+same-page-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'vimaanatech.com')
  assert.match(provider.modulePath, /vimaanaaerospacetechnologies[\\/]script\.js$/i)
})

test('Vimaana Aerospace Technologies matches company coverage without colliding with Vimaan', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Vimaan,\nVimaana Aerospace Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Vimaan', 'vimaan', 'Vimaan'],
      ['Vimaana Aerospace Technologies', 'vimaanaaerospacetechnologies', 'Vimaana Aerospace Technologies'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'vimaanaaerospacetechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Vimaana Aerospace Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vimaanaaerospacetechnologies')
  assert.equal(scraper.provider.companyName, 'Vimaana Aerospace Technologies')
  assert.match(scraper.dryRunFile, /vimaanaaerospacetechnologies[\\/]jobs\.json$/i)
})

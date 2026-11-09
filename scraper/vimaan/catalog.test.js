import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Vimaan is registered as a verified first-party public WordPress jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vimaan')

  assert.ok(provider, 'Expected Vimaan provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Vimaan')
  assert.equal(provider.companyCareerPage, 'https://vimaan.ai/careers/')
  assert.equal(provider.atsPlatform, 'wordpress-job-manager')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'unfiltered-public-ajax-pagination')
  assert.equal(provider.extractionStrategy, 'verified-homepage+verified-about-page+verified-contact-page+verified-careers-shell+unfiltered-wordpress-jobs-inventory')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'vimaan.ai')
  assert.match(provider.modulePath, /vimaan[\\/]script\.js$/i)
})

test('Vimaan and Vimaana Aerospace Technologies match different providers without collapsing into one another', () => {
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

  const scraper = buildScrapers().find((item) => item.name === 'vimaan')

  assert.ok(scraper, 'Expected buildScrapers() to return the Vimaan scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vimaan')
  assert.equal(scraper.provider.companyName, 'Vimaan')
  assert.match(scraper.dryRunFile, /vimaan[\\/]jobs\.json$/i)
})

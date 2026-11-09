import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Green Avni Solutions LLP is registered as a verified first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'greenavni')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Green Avni Solutions LLP')
  assert.equal(provider.companyCareerPage, 'https://www.greenavni.com/open-positions/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-careers-and-open-positions-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-careers-page+verified-open-positions-page+shared-mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'greenavni.com')
  assert.match(provider.modulePath, /greenavni[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Green Avni Solutions LLP'), false)
})

test('Green Avni Solutions LLP matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Green Avni Solutions LLP,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Green Avni Solutions LLP', 'greenavni', 'Green Avni Solutions LLP']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'greenavni')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'greenavni')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.greenavni.com/open-positions/')
  assert.match(scraper.dryRunFile, /greenavni[\\/]jobs\.json$/i)
})

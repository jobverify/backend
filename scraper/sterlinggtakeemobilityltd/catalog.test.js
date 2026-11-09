import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'sterlinggtakeemobilityltd'
const COMPANY = 'Sterling Gtake E-mobility Ltd'
const CAREERS_URL = 'https://www.sterlinggtake.com/'

test('Sterling Gtake E-mobility Ltd is registered as a verified parked-shell first-party scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Sterling Gtake E-mobility Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-parked-homepage-shell+verified-common-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sterlinggtake.com')
  assert.match(provider.modulePath, /sterlinggtakeemobilityltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sterling Gtake E-mobility Ltd.'), false)
})

test('Sterling Gtake E-mobility Ltd resolves both CSV spellings from provider metadata and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Sterling Gtake E-mobility Ltd,\nSterling Gtake E-mobility Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Sterling Gtake E-mobility Ltd', SOURCE, COMPANY],
      ['Sterling Gtake E-mobility Ltd.', SOURCE, COMPANY],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Sterling Gtake E-mobility Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_URL)
  assert.match(scraper.dryRunFile, /sterlinggtakeemobilityltd[\\/]jobs\.json$/i)
})

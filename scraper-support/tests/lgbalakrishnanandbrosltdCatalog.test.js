import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('L.G.Balakrishnan & Bros Ltd is registered as a verified first-party candidate-portal scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lgbalakrishnanandbrosltd')

  assert.ok(provider, 'Expected L.G.Balakrishnan & Bros Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'L.G.Balakrishnan & Bros Ltd')
  assert.equal(provider.companyCareerPage, 'https://connectgate.lgbportal.co.in/careers/')
  assert.equal(provider.atsPlatform, 'official-current-native-candidate-portal-country-application-scope-held')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'literal-own-root301-and-active-current-portal-native-rows-full-details-programmes-opening-closing')
  assert.equal(
    provider.extractionStrategy,
    'whole-current-own-native-vacancy-rows-and-criteria+native-ids-and-full-forms-retained+country-browser-application-and-company-scope-held',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lgb.co.in')
  assert.match(provider.modulePath, /lgbalakrishnanandbrosltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'L.G.Balakrishnan & Bros Ltd'), false)
})

test('L.G.Balakrishnan & Bros Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'L.G.Balakrishnan & Bros Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['L.G.Balakrishnan & Bros Ltd', 'lgbalakrishnanandbrosltd', 'L.G.Balakrishnan & Bros Ltd']],
  )
})

test('L.G.Balakrishnan & Bros Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'lgbalakrishnanandbrosltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the L.G.Balakrishnan & Bros Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lgbalakrishnanandbrosltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://connectgate.lgbportal.co.in/careers/')
  assert.match(scraper.dryRunFile, /lgbalakrishnanandbrosltd[\\/]jobs\.json$/i)
})

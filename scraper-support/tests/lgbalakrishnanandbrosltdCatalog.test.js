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
  assert.equal(provider.companyCareerPage, 'https://careers.lgbportal.co.in/')
  assert.equal(provider.atsPlatform, 'official-first-party-candidate-portal')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-first-party-careers-portal')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-portal+inline-job-cards+apply-links',
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
  assert.equal(scraper.provider.companyCareerPage, 'https://careers.lgbportal.co.in/')
  assert.match(scraper.dryRunFile, /lgbalakrishnanandbrosltd[\\/]jobs\.json$/i)
})

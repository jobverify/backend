import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Nurture.Farm is registered on the official join-us page with a verified Skillate handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nurturefarm')

  assert.ok(provider, 'Expected Nurture.Farm provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Nurture.Farm')
  assert.equal(provider.companyCareerPage, 'https://nurture.farm/join-us-2/')
  assert.equal(provider.atsPlatform, 'skillate')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-join-us-handoff+single-page-listing')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+skillate-dom')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nurture.farm')
  assert.match(provider.modulePath, /nurturefarm[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nurture.Farm'), false)
})

test('Nurture.Farm matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Nurture.Farm\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Nurture.Farm', 'nurturefarm'],
  ])
})

test('Nurture.Farm is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nurturefarm')

  assert.ok(scraper, 'Expected buildScrapers() to return the Nurture.Farm scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nurturefarm')
  assert.equal(scraper.provider.companyCareerPage, 'https://nurture.farm/join-us-2/')
  assert.match(scraper.dryRunFile, /nurturefarm[\\/]jobs\.json$/i)
})

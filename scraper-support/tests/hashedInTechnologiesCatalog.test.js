import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('HashedIn Technologies is registered against the verified first-party careers experience without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hashedintechnologies')

  assert.ok(provider, 'Expected HashedIn Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HashedIn Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.hashedin.com/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-plus-first-party-json-feeds')
  assert.equal(
    provider.extractionStrategy,
    'official-homepage-validation+official-careers-page+first-party-json-job-feeds+first-party-apply-subdomain-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hashedin.com')
  assert.match(provider.modulePath, /hashedintechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'HashedIn Technologies'), false)
})

test('HashedIn Technologies matches the backlog directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'HashedIn Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HashedIn Technologies', 'hashedintechnologies', 'HashedIn Technologies']],
  )
})

test('HashedIn Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hashedintechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the HashedIn Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hashedintechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.hashedin.com/')
  assert.match(scraper.dryRunFile, /hashedintechnologies[\\/]jobs\.json$/i)
})

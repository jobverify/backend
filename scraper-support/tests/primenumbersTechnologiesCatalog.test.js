import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Primenumbers Technologies is registered against the verified first-party careers surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'primenumberstechnologies')

  assert.ok(provider, 'Expected Primenumbers Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Primenumbers Technologies Private Limited')
  assert.equal(provider.companyCareerPage, 'https://primenumbers.in/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-index-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'active-first-party-cards+own-full-native-JobPosting+explicit-country-and-legal-employer+published-application-anchor+incomplete-source-scope',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'primenumbers.in')
  assert.match(provider.modulePath, /primenumberstechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Primenumbers Technologies'), false)
})

test('Primenumbers Technologies matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Primenumbers Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Primenumbers Technologies',
      'primenumberstechnologies',
      'Primenumbers Technologies Private Limited',
    ]],
  )
})

test('Primenumbers Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'primenumberstechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Primenumbers Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'primenumberstechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://primenumbers.in/careers/')
  assert.match(scraper.dryRunFile, /primenumberstechnologies[\\/]jobs\.json$/i)
})

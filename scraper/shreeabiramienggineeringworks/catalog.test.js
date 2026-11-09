import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'shreeabiramienggineeringworks'
const COMPANY = 'SHREE ABIRAMI ENGGINEERING WORKS'

test('SHREE ABIRAMI ENGGINEERING WORKS is registered as a search-backed absent-surface sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected SHREE ABIRAMI ENGGINEERING WORKS provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, null)
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.shreeabirami.com/',
    'https://shreeabirami.com/',
    'https://www.shreeabirami.co.in/',
    'https://shreeabirami.co.in/',
    'https://www.shreeabirami.in/',
    'https://shreeabirami.in/',
  ])
  assert.equal(provider.atsPlatform, 'no-trustworthy-first-party-public-jobs-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'none')
  assert.equal(
    provider.extractionStrategy,
    'verified-nxdomain-candidate-domains-plus-no-first-party-search-surface-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, null)
  assert.match(provider.modulePath, /shreeabiramienggineeringworks[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('SHREE ABIRAMI ENGGINEERING WORKS matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY}\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )
})

test('SHREE ABIRAMI ENGGINEERING WORKS is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the SHREE ABIRAMI ENGGINEERING WORKS scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, null)
  assert.match(scraper.dryRunFile, /shreeabiramienggineeringworks[\\/]jobs\.json$/i)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'learningvertos'
const COMPANY = 'Learning Vertos'
const HOMEPAGE_URL = 'https://learningvertos.com/'

test('Learning Vertos is registered as a verified absent-surface probe sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Learning Vertos provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, HOMEPAGE_URL)
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.learningvertos.com/',
    'https://learningvertos.com/careers',
    'https://www.learningvertos.com/careers',
    'https://learningvertos.in/',
    'https://www.learningvertos.in/',
    'https://learningvertos.co.in/',
    'https://www.learningvertos.co.in/',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-first-party-homepages-and-careers-route-network-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-candidates-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'learningvertos.com')
  assert.match(provider.modulePath, /learningvertos[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Learning Vertos matches company coverage directly from provider metadata', () => {
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

test('Learning Vertos is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Learning Vertos scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, HOMEPAGE_URL)
  assert.match(scraper.dryRunFile, /learningvertos[\\/]jobs\.json$/i)
})

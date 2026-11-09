import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Amravati Software Innovations is registered as a verified absent-first-party-surface sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amravatisoftwareinnovations')

  assert.ok(provider, 'Expected Amravati Software Innovations provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Amravati Software Innovations')
  assert.equal(provider.companyCareerPage, 'https://amravatisoftwareinnovations.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-first-party-domain-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-absent-first-party-domains-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'amravatisoftwareinnovations.com')
  assert.match(provider.modulePath, /amravatisoftwareinnovations[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Amravati Software Innovations'), false)
})

test('Amravati Software Innovations matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Amravati Software Innovations,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amravati Software Innovations', 'amravatisoftwareinnovations', 'Amravati Software Innovations']],
  )
})

test('Amravati Software Innovations is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'amravatisoftwareinnovations')

  assert.ok(scraper, 'Expected buildScrapers() to return the Amravati Software Innovations scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'amravatisoftwareinnovations')
  assert.equal(scraper.provider.companyCareerPage, 'https://amravatisoftwareinnovations.com/')
  assert.match(scraper.dryRunFile, /amravatisoftwareinnovations[\\/]jobs\.json$/i)
})

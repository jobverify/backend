import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('KeshavSoft is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'keshavsoft')

  assert.ok(provider, 'Expected KeshavSoft provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'KeshavSoft')
  assert.equal(
    provider.companyCareerPage,
    'https://keshavsoft.com/Students/HtmlFiles/registerForInternsV5.html',
  )
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-internship-form-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-internship-interest-form+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'keshavsoft.com')
  assert.match(provider.modulePath, /keshavsoft[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'KeshavSoft'), false)
})

test('KeshavSoft matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'KeshavSoft,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KeshavSoft', 'keshavsoft', 'KeshavSoft']],
  )
})

test('KeshavSoft is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'keshavsoft')

  assert.ok(scraper, 'Expected buildScrapers() to return the KeshavSoft scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'keshavsoft')
  assert.equal(
    scraper.provider.companyCareerPage,
    'https://keshavsoft.com/Students/HtmlFiles/registerForInternsV5.html',
  )
  assert.match(scraper.dryRunFile, /keshavsoft[\\/]jobs\.json$/i)
})

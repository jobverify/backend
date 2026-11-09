import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Pentagon Space is registered against the verified official homepage with no public careers routes', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pentagonspace')

  assert.ok(provider, 'Expected Pentagon Space provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Pentagon Space')
  assert.equal(provider.companyCareerPage, 'https://pentagonspace.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pentagonspace.in')
  assert.match(provider.modulePath, /pentagonspace[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pentagon Space'), false)
})

test('Pentagon Space matches the backlog directly from provider metadata without adding a company alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Pentagon Space,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pentagon Space', 'pentagonspace', 'Pentagon Space']],
  )
})

test('Pentagon Space is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'pentagonspace')

  assert.ok(scraper, 'Expected buildScrapers() to return the Pentagon Space scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'pentagonspace')
  assert.equal(scraper.provider.companyCareerPage, 'https://pentagonspace.in/')
  assert.match(scraper.dryRunFile, /pentagonspace[\\/]jobs\.json$/i)
})

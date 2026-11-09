import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Technotreon is registered against the verified first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'technotreon')

  assert.ok(provider, 'Expected Technotreon provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Technotreon')
  assert.equal(provider.companyCareerPage, 'https://technotreon.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+Pune-careers-title+numbered-role-cards+google-forms-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'technotreon.in')
  assert.match(provider.modulePath, /technotreon[\\/]script\.js$/i)
})

test('Technotreon matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Technotreon\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Technotreon', 'technotreon', 'Technotreon']],
  )
})

test('Technotreon is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'technotreon')

  assert.ok(scraper, 'Expected buildScrapers() to return the Technotreon scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'technotreon')
  assert.equal(scraper.provider.companyCareerPage, 'https://technotreon.in/careers')
  assert.match(scraper.dryRunFile, /technotreon[\\/]jobs\.json$/i)
})

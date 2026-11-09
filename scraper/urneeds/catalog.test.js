import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Urneeds is registered as a verified parked-domain sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'urneeds')

  assert.ok(provider, 'Expected Urneeds provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Urneeds')
  assert.equal(provider.companyCareerPage, 'https://www.urneeds.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-first-party-route-redirect-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-redirect-shell-plus-parked-lander-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'urneeds.in')
  assert.match(provider.modulePath, /urneeds[\\/]script\.js$/i)
})

test('Urneeds resolves both CSV spellings through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Urneeds,\nurneeds,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Urneeds', 'urneeds', 'Urneeds'],
      ['urneeds', 'urneeds', 'Urneeds'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'urneeds')

  assert.ok(scraper, 'Expected buildScrapers() to return the Urneeds scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'urneeds')
  assert.equal(scraper.provider.companyName, 'Urneeds')
  assert.match(scraper.dryRunFile, /urneeds[\\/]jobs\.json$/i)
})

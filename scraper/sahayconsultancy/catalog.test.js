import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Sahay Consultancy is registered as an unresolved-domain sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sahayconsultancy')

  assert.ok(provider, 'Expected Sahay Consultancy provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sahay Consultancy')
  assert.equal(provider.companyCareerPage, 'https://www.sahayconsultancy.com/')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://sahayconsultancy.com/',
    'https://www.sahayconsultancy.in/',
    'https://sahayconsultancy.in/',
    'https://www.sahayconsultancy.co.in/',
    'https://sahayconsultancy.co.in/',
    'https://www.sahayconsultancy.com/careers',
    'https://www.sahayconsultancy.com/career',
    'https://www.sahayconsultancy.com/jobs',
    'https://www.sahayconsultancy.com/join-us',
    'https://www.sahayconsultancy.com/work-with-us',
    'https://www.sahayconsultancy.com/openings',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-first-party-homepages-and-careers-route-network-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-host-candidates-and-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sahayconsultancy.com')
  assert.match(provider.modulePath, /sahayconsultancy[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sahay Consultancy'), false)
})

test('Sahay Consultancy matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Sahay Consultancy,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sahay Consultancy', 'sahayconsultancy', 'Sahay Consultancy']],
  )
})

test('Sahay Consultancy is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sahayconsultancy')

  assert.ok(scraper, 'Expected buildScrapers() to return the Sahay Consultancy scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sahayconsultancy')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.sahayconsultancy.com/')
  assert.match(scraper.dryRunFile, /sahayconsultancy[\\/]jobs\.json$/i)
})

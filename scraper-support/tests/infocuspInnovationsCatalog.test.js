import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('InfoCusp Innovations is registered as an official SSR careers provider with Zoho applications without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'infocuspinnovations')

  assert.ok(provider, 'Expected InfoCusp Innovations provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'InfoCusp Innovations')
  assert.equal(provider.companyCareerPage, 'https://www.infocusp.com/careers/openings/')
  assert.equal(provider.atsPlatform, 'first-party-server-rendered-openings-plus-zoho-recruit-application-links')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-complete-server-rendered-card-listing')
  assert.equal(provider.extractionStrategy, 'verified-official-homepage+careers-cards+matched-job-description-and-zoho-application-identity')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 5)
  assert.equal(provider.verifiedIndiaJobCount, 5)
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'infocusp.com')
  assert.match(provider.modulePath, /infocuspinnovations[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'InfoCusp Innovations'), false)
})

test('InfoCusp Innovations matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'InfoCusp Innovations,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['InfoCusp Innovations', 'infocuspinnovations', 'InfoCusp Innovations']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'infocuspinnovations')

  assert.ok(scraper, 'Expected buildScrapers() to return the InfoCusp Innovations scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'infocuspinnovations')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.infocusp.com/careers/openings/')
  assert.match(scraper.dryRunFile, /infocuspinnovations[\\/]jobs\.json$/i)
})

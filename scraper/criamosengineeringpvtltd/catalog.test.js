import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('CRIAMOS ENGINEERING PVT LTD is registered as a verified first-party careers scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'criamosengineeringpvtltd')

  assert.ok(provider, 'Expected CRIAMOS ENGINEERING PVT LTD provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CRIAMOS ENGINEERING PVT LTD')
  assert.equal(provider.companyCareerPage, 'https://www.criamose.com/index.php/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-careers-page+inline-numbered-openings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'criamose.com')
  assert.match(provider.modulePath, /criamosengineeringpvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'CRIAMOS ENGINEERING PVT LTD'), false)
})

test('CRIAMOS ENGINEERING PVT LTD matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'CRIAMOS ENGINEERING PVT LTD,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CRIAMOS ENGINEERING PVT LTD', 'criamosengineeringpvtltd', 'CRIAMOS ENGINEERING PVT LTD']],
  )
})

test('CRIAMOS ENGINEERING PVT LTD is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'criamosengineeringpvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the CRIAMOS ENGINEERING PVT LTD scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'criamosengineeringpvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.criamose.com/index.php/careers')
  assert.match(scraper.dryRunFile, /criamosengineeringpvtltd[\\/]jobs\.json$/i)
})

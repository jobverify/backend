import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('dhiOmics is registered as a verified ADA Global Darwinbox handoff without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dhiomics')

  assert.ok(provider, 'Expected dhiOmics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'dhiOmics')
  assert.equal(provider.companyCareerPage, 'https://adaglobal.com/careers/')
  assert.equal(provider.atsPlatform, 'darwinbox-public-candidate-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-redirect-plus-official-careers-validation-plus-darwinbox-alljobs-pagination',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-dhiomics-homepage-redirect+verified-ada-careers-page+verified-darwinbox-alljobs-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'adaglobal.com')
  assert.match(provider.modulePath, /dhiomics[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'dhiOmics'), false)
})

test('dhiOmics matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'dhiOmics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['dhiOmics', 'dhiomics', 'dhiOmics']],
  )
})

test('dhiOmics is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'dhiomics')

  assert.ok(scraper, 'Expected buildScrapers() to return the dhiOmics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'dhiomics')
  assert.equal(scraper.provider.companyCareerPage, 'https://adaglobal.com/careers/')
  assert.match(scraper.dryRunFile, /dhiomics[\\/]jobs\.json$/i)
})

test('dhiOmics current published API metadata never claims authoritative India coverage',()=>{
 const provider=getScraperCatalog().find(p=>p.source==='dhiomics')
 assert.equal(provider.publicListingApiUrl,'https://adaglobal.darwinbox.com/ms/candidateapi/job/alljobs')
 assert.equal(provider.listingComplete,false)
 assert.equal(provider.indiaInventoryTotal,null)
 assert.match(provider.verifiedSurfaceSummary,/57.*15|15.*57/)
})

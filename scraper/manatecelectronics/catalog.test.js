import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Manatec Electronics Private Limited is registered with the verified first-party careers page and needs no alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'manatecelectronics')

  assert.ok(provider, 'Expected Manatec Electronics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Manatec Electronics Private Limited')
  assert.equal(provider.companyCareerPage, 'https://manatec.in/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'bounded-homepage-plus-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+application-only-careers+typed-unavailable-inventory',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'manatec.in')
  assert.match(provider.modulePath, /manatecelectronics[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Manatec Electronics Private Limited'), false)
})

test('Manatec Electronics Private Limited matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Manatec Electronics Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Manatec Electronics Private Limited', 'manatecelectronics', 'Manatec Electronics Private Limited']],
  )
})

test('Manatec Electronics is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'manatecelectronics')

  assert.ok(scraper, 'Expected buildScrapers() to return the Manatec Electronics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'manatecelectronics')
  assert.equal(scraper.provider.companyCareerPage, 'https://manatec.in/career/')
  assert.match(scraper.dryRunFile, /manatecelectronics[\\/]jobs\.json$/i)
})

test('registered Manatec ordinary denial remains unknown inventory with saved-vacancy cleanup disabled', async () => {
  const { readInventoryEvidence, isVerifiedEmptyEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
  const { inventoryCleanupOptions } = await import('../../scraper-support/utils/scraperOutcome.js')
  const requestedUrls = [], scraper = buildScrapers().find(item => item.name === 'manatecelectronics')
  const jobs = await scraper.run({ fetchPage: async url => { requestedUrls.push(url); return { status: 403, url, html: 'Forbidden' } } })
  assert.deepEqual(requestedUrls, ['https://manatec.in/'])
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  assert.deepEqual(inventoryCleanupOptions({ inventoryEvidence: evidence }), { replaceExisting: false })
})

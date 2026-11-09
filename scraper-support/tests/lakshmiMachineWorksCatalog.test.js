import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Lakshmi Machine Works is registered as a Darwinbox scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lakshmimachineworks')

  assert.ok(provider, 'Expected Lakshmi Machine Works provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Lakshmi Machine Works')
  assert.equal(
    provider.companyCareerPage,
    'https://www.lmwglobal.com/',
  )
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-public-pagination-with-total-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-handoff+complete-public-darwinbox-inventory',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lmwglobal.com')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.ok(provider.bindingEvidence.matchedLinks.includes('https://lmwanubhav.darwinbox.in/ms/candidate/careers'))
  assert.equal(provider.bindingEvidence.inventorySurface, 'https://lmwanubhav.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.match(provider.modulePath, /lakshmimachineworks[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Lakshmi Machine Works'), false)
})

test('Lakshmi Machine Works matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Lakshmi Machine Works,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lakshmi Machine Works', 'lakshmimachineworks', 'Lakshmi Machine Works']],
  )
})

test('Lakshmi Machine Works is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'lakshmimachineworks')

  assert.ok(scraper, 'Expected buildScrapers() to return the Lakshmi Machine Works scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lakshmimachineworks')
  assert.equal(
    scraper.provider.companyCareerPage,
    'https://www.lmwglobal.com/',
  )
  assert.match(scraper.dryRunFile, /lakshmimachineworks[\\/]jobs\.json$/i)
})

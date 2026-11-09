import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Vivriti Capital is registered as a verified first-party Darwinbox inventory provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vivriticapital')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Vivriti Capital')
  assert.equal(provider.companyCareerPage, 'https://www.vivriticapital.com/work-with-us.html')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-public-pagination-with-total-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-handoff+complete-public-darwinbox-inventory',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'vivriticapital.com')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.ok(provider.bindingEvidence.matchedLinks.includes('https://vivriti.darwinbox.in/ms/candidate/careers'))
  assert.equal(provider.bindingEvidence.inventorySurface, 'https://vivriti.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.match(provider.modulePath, /vivriticapital[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Vivriti Capital'), false)
})

test('Vivriti Capital resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Vivriti Capital,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Vivriti Capital', 'vivriticapital', 'Vivriti Capital']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'vivriticapital')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vivriticapital')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.vivriticapital.com/work-with-us.html')
  assert.match(scraper.dryRunFile, /vivriticapital[\\/]jobs\.json$/i)
})

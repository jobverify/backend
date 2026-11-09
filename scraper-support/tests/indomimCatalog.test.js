import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('INDO-MIM Limited is registered against the verified official careers form with the narrow CSV alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indomim')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'INDO-MIM Limited')
  assert.equal(provider.companyCareerPage, 'https://www.indo-mim.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(provider.extractionStrategy, 'resume-form-no-openings-or-verified-sucuri-js-challenge')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'indo-mim.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /sucuri/i)
  assert.match(provider.modulePath, /indomim[\\/]script\.js$/i)
  assert.equal(companyAliases['INDO-MIM'], 'indomim')
})

test('company coverage resolves both INDO-MIM backlog rows to the same official source', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'INDO-MIM,\nINDO-MIM Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['INDO-MIM', 'indomim', 'INDO-MIM Limited'],
      ['INDO-MIM Limited', 'indomim', 'INDO-MIM Limited'],
    ],
  )
})

test('INDO-MIM is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'indomim')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indomim')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.indo-mim.com/careers/')
  assert.match(scraper.dryRunFile, /indomim[\\/]jobs\.json$/i)
})

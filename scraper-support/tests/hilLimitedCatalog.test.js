import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('HIL Limited is registered against the verified BirlaNu people page and Darwinbox handoff sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hillimited')

  assert.ok(provider, 'Expected HIL Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HIL Limited')
  assert.equal(provider.companyCareerPage, 'https://birlanu.com/people')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-landing')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+darwinbox-handoff-no-first-party-job-records',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'birlanu.com')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /Darwinbox/i)
  assert.match(provider.modulePath, /hillimited[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'HIL Limited'), false)
})

test('HIL Limited matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'HIL Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['HIL Limited', 'hillimited'],
  ])
})

test('HIL Limited is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hillimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the HIL Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hillimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://birlanu.com/people')
  assert.match(scraper.dryRunFile, /hillimited[\\/]jobs\.json$/i)
})

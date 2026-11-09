import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('FlintLab is registered against the verified official homepage with no public careers routes', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'flintlab')

  assert.ok(provider, 'Expected FlintLab provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'FlintLab')
  assert.equal(provider.companyCareerPage, 'https://flintlab.io/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-sitemap-without-careers+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'flintlab.io')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Ship Mobile & Web Apps/i)
  assert.match(provider.verifiedSurfaceSummary, /Ask FlintBot/i)
  assert.match(provider.modulePath, /flintlab[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'FlintLab'), false)
})

test('FlintLab matches the backlog directly from provider metadata without adding a company alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'FlintLab,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FlintLab', 'flintlab', 'FlintLab']],
  )
})

test('FlintLab is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'flintlab')

  assert.ok(scraper, 'Expected buildScrapers() to return the FlintLab scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'flintlab')
  assert.equal(scraper.provider.companyCareerPage, 'https://flintlab.io/')
  assert.match(scraper.dryRunFile, /flintlab[\\/]jobs\.json$/i)
})

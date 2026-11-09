import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../../scraper-support/providers/index.js'

test('Sketch Brahma Technologies is registered against the verified first-party careers bundle', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sketchbrahmatechnologies')

  assert.ok(provider, 'Expected Sketch Brahma Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sketch Brahma Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.sketchbrahma.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-shell-plus-next-build-manifest-plus-careers-bundle')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-shell+verified-careers-page-bundle+inline-job-arrays+first-party-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sketchbrahma.com')
  assert.match(provider.modulePath, /sketchbrahmatechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sketch Brahma Technologies'), false)
})

test('Sketch Brahma Technologies exact-company CSV rows resolve without aliases and buildScrapers exposes the lane', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Sketch Brahma Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Sketch Brahma Technologies',
      'sketchbrahmatechnologies',
      'Sketch Brahma Technologies',
    ]],
  )

  const scraper = buildScrapers().find((item) => item.name === 'sketchbrahmatechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Sketch Brahma Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sketchbrahmatechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.sketchbrahma.com/careers')
  assert.match(scraper.dryRunFile, /sketchbrahmatechnologies[\\/]jobs\.json$/i)
})

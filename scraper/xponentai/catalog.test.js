import assert from 'node:assert/strict'
import test from 'node:test'
import {fixture,recordedBody} from './fixture20261120.js'
import {primary} from './data20261108.js'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('xponent.ai centralized Global discovery descriptors identify the source without claiming native country or inventory completeness', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'xponentai')

  // Static centralized discovery descriptors are not proof of native work
  // country, complete company inventory or cleanup permission. Full original
  // runtime replays and explicit source receipts establish those separately.
  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'xponent.ai')
  assert.equal(provider.companyCareerPage, 'https://xponent.ai/career/')
  assert.equal(provider.atsPlatform, 'wp-job-openings')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-first-party-wp-rest-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+official-wordpress-job-openings-rest-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'xponent.ai')
  assert.equal(provider.verifiedIndiaJobCount??null, null)
  assert.equal(provider.verifiedPublicJobCount??null, null)
  assert.notEqual(provider.sourceScopeComplete, true)
  assert.notEqual(provider.lifecycleCleanupAllowed, true)
  assert.match(provider.modulePath, /xponentai[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'xponent.ai'), false)
})

test('xponent.ai resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'xponent.ai,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['xponent.ai', 'xponentai', 'xponent.ai']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'xponentai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'xponentai')
  assert.equal(scraper.provider.companyCareerPage, 'https://xponent.ai/career/')
  assert.match(scraper.dryRunFile, /xponentai[\\/]jobs\.json$/i)
})

test('actual current employer careers declaration binds the same WP Job Openings plugin without external requests',()=>{
 const model=primary(recordedBody(fixture.responses[0]).toString());assert.equal(model.primaryURL,'https://xponent.ai/career/');assert.equal(model.indexURL,'https://xponent.ai/wp-json/');assert.equal(new URL(model.jobPluginURL).pathname,'/wp-content/plugins/wp-job-openings/assets/js/script.min.js');assert.equal(model.publisherProgramsExecuted,false)
})

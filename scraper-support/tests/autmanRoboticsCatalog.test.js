import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Autman Robotics is registered against the verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'autmanrobotics')

  assert.ok(provider, 'Expected Autman Robotics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Autman Robotics')
  assert.equal(provider.companyCareerPage, 'https://www.aut-man.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'United Kingdom')
  assert.equal(provider.paginationStrategy, 'homepage-plus-single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-public-openings+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aut-man.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Robotics Engineer/i)
  assert.match(provider.modulePath, /autmanrobotics[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Autman Robotics'), false)
})

test('Autman Robotics matches coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Autman Robotics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Autman Robotics', 'autmanrobotics', 'Autman Robotics']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'autmanrobotics')

  assert.ok(scraper, 'Expected buildScrapers() to return the Autman Robotics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'autmanrobotics')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.aut-man.com/careers')
  assert.match(scraper.dryRunFile, /autmanrobotics[\\/]jobs\.json$/i)
})

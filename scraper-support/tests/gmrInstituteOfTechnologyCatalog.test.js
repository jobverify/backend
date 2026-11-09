import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes GMR Institute of Technology on the verified first-party careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gmrinstituteoftechnology')

  assert.ok(provider, 'Expected GMR Institute of Technology provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GMR Institute of Technology')
  assert.equal(provider.companyCareerPage, 'https://gmrit.edu.in/careers.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-handoff-plus-current-vacancy-table')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-handoff+first-party-current-vacancy-table+ignore-commented-rows',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'gmrit.edu.in')
  assert.match(provider.modulePath, /gmrinstituteoftechnology[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GMR Institute of Technology scraper and exact coverage works without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gmrinstituteoftechnology')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gmrinstituteoftechnology')
  assert.match(scraper.dryRunFile, /gmrinstituteoftechnology[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'GMR Institute of Technology,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GMR Institute of Technology', 'gmrinstituteoftechnology', 'GMR Institute of Technology']],
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Axis My India as a verified Zoho Recruit wrapper source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'axismyindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'Axis My India')
  assert.equal(provider.companyCareerPage, 'https://www.axismyindia.org/career')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-handoff-plus-public-zoho-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+branded-zohorecruit-portal+public-job-openings-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'axismyindia.org')
  assert.match(provider.modulePath, /axismyindia[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Axis My India to axismyindia', () => {
  const scraper = buildScrapers().find((item) => item.name === 'axismyindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'axismyindia')
  assert.match(scraper.dryRunFile, /axismyindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Axis My India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Axis My India', 'axismyindia', 'axismyindia']],
  )
})

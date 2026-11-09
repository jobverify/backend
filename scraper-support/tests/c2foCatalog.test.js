import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { getRunnerMetadata } from '../../scraper/c2fo/script.js'

test('getScraperCatalog includes C2FO as a verified Dayforce script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'c2fo')
  const metadata = getRunnerMetadata()

  assert.ok(provider)
  assert.equal(provider.source, 'c2fo')
  assert.equal(provider.companyName, 'C2FO')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://c2fo.com/careers/')
  assert.equal(provider.baseUrl, 'https://jobs.dayforcehcm.com/en-US/c2fo/CANDIDATEPORTAL')
  assert.equal(provider.atsPlatform, 'dayforce')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'paginationStart-offset-dayforce-search')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-handoff+dayforce-jobposting-search+detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'c2fo.com')
  assert.match(provider.modulePath, /c2fo[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /c2fo[\\/]jobs\.json$/i)

  assert.equal(metadata.name, provider.source)
  assert.equal(metadata.provider.companyName, provider.companyName)
  assert.equal(metadata.provider.companyCareerPage, provider.companyCareerPage)
  assert.equal(metadata.provider.baseUrl, provider.baseUrl)
})

test('buildScrapers and company coverage resolve C2FO from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'c2fo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'c2fo')
  assert.match(scraper.dryRunFile, /c2fo[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'C2FO,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['C2FO', 'c2fo', 'C2FO']],
  )
})

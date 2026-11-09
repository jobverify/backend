import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog routes BharatPe through the current official Darwinbox handoff with runtime evidence', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bharatpe')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyName, 'BharatPe')
  assert.equal(provider.companyCareerPage, 'https://bharatpe.com/career')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.officialSiteUrl, 'https://bharatpe.com/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://bharatpe.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(provider.darwinboxOrigin, 'https://bharatpe.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.publicAllJobsUrl, provider.officialCareersHandoffUrl)
  assert.equal(provider.paginationStrategy, 'public-darwinbox-listing-pagination')
  assert.equal(
    provider.extractionStrategy,
    'official-corporate-careers-handoff+employer-bound-darwinbox-listing-api+native-role-detail-hydration',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'bharatpe.com')
  assert.match(provider.modulePath, /bharatpe[\\/]script\.js$/i)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.ok(provider.verifiedIndiaJobCount == null)
  assert.notEqual(provider.verifiedInventoryStatus, 'verified-empty')
})

test('buildScrapers and company coverage resolve BharatPe to bharatpe', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bharatpe')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bharatpe')
  assert.match(scraper.dryRunFile, /bharatpe[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'BharatPe,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['BharatPe', 'bharatpe', 'bharatpe']],
  )
})

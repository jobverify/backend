import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadProviderContract = async () => {
  try {
    return (await import('../../scraper/affle/provider.json', { with: { type: 'json' } })).default
  } catch {
    assert.fail('Expected Affle provider contract at ../../scraper/affle/provider.json')
  }
}

test('Affle provider contract captures the live first-party careers handoff and Darwinbox surface', async () => {
  const providerContract = await loadProviderContract()
  const provider = hydrateProviderCatalogEntry(providerContract)

  assert.equal(provider.source, 'affle')
  assert.equal(provider.companyName, 'Affle')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://affle.com/career')
  assert.equal(provider.officialSiteUrl, 'https://affle.com/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://affle.darwinbox.in/ms/candidate/careers')
  assert.equal(provider.darwinboxOrigin, 'https://affle.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.publicAllJobsUrl, 'https://affle.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+official-darwinbox-handoff+darwinbox-listing-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'affle.com')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/affle\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/affle\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /public India openings/i)
  assert.match(provider.modulePath, /affle[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /affle[\\/]jobs\.json$/i)
})

test('Affle provider contract hydrates into company coverage matching', async () => {
  const providerContract = await loadProviderContract()
  const report = generateCompanyCoverageReport({
    csvText: 'Affle\n',
    catalog: [hydrateProviderCatalogEntry(providerContract)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Affle', 'affle', 'Affle']],
  )
})

test('buildScrapers and company coverage resolve Affle from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'affle')
  const scraper = buildScrapers().find((item) => item.name === 'affle')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Affle')
  assert.equal(provider.companyCareerPage, 'https://affle.com/career')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /affle[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Affle\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Affle', 'affle', 'Affle']],
  )
})

import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const encompassModulePath = path.resolve(currentDir, '../../scraper/encompass/script.js')

const loadEncompassCatalog = async () => {
  try {
    return await import('../../scraper/encompass/catalog.js')
  } catch {
    assert.fail('Expected Encompass catalog module at ../../scraper/encompass/catalog.js')
  }
}

const loadEncompassModule = async () => {
  try {
    return await import('../../scraper/encompass/script.js')
  } catch {
    assert.fail('Expected Encompass scraper module at ../../scraper/encompass/script.js')
  }
}

test('Encompass local catalog captures the verified first-party careers handoff to the Pinpoint board', async () => {
  const { ENCOMPASS_CATALOG } = await loadEncompassCatalog()
  const encompass = await loadEncompassModule()
  const provider = hydrateProviderCatalogEntry(ENCOMPASS_CATALOG)

  assert.equal(provider.source, 'encompass')
  assert.equal(provider.companyName, 'Encompass')
  assert.equal(provider.officialBrandName, 'Encompass Corporation')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.encompasscorporation.com/')
  assert.equal(provider.companyCareerPage, 'https://www.encompasscorporation.com/careers/')
  assert.equal(provider.careersEntryUrl, 'https://www.encompasscorporation.com/careers')
  assert.equal(provider.careersPageUrl, 'https://www.encompasscorporation.com/careers/')
  assert.equal(provider.officialPinpointBoardUrl, 'https://encompass.pinpointhq.com/')
  assert.equal(provider.pinpointPostingsUrl, 'https://encompass.pinpointhq.com/postings.json')
  assert.equal(provider.pinpointRssUrl, 'https://encompass.pinpointhq.com/jobs.rss')
  assert.deepEqual(provider.verifiedFirstPartyUrls, [
    'https://www.encompasscorporation.com/',
    'https://www.encompasscorporation.com/careers',
    'https://www.encompasscorporation.com/careers/',
  ])
  assert.deepEqual(provider.linkedCareerUrls, [
    'https://encompass.pinpointhq.com/#js-careers-jobs-block',
    'https://encompass.pinpointhq.com/',
    'https://encompass.pinpointhq.com/postings.json',
    'https://encompass.pinpointhq.com/jobs.rss',
  ])
  assert.equal(provider.companyDomain, 'encompasscorporation.com')
  assert.equal(provider.atsPlatform, 'pinpointhq')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'pinpoint-postings-json')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-pinpoint-board+verified-pinpoint-postings-json+india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(ENCOMPASS_CATALOG.dryRunFile, 'encompass/jobs.json')
  assert.equal(provider.modulePath, encompassModulePath)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.encompasscorporation\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.encompasscorporation\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/encompass\.pinpointhq\.com\/#js-careers-jobs-block/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/encompass\.pinpointhq\.com\/postings\.json/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Platform Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Glasgow/i)
  assert.match(provider.verifiedSurfaceSummary, /no current India listings/i)

  assert.equal(encompass.PROVIDER_METADATA.source, provider.source)
  assert.equal(encompass.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(encompass.PROVIDER_METADATA.careersPageUrl, provider.careersPageUrl)
  assert.equal(encompass.PROVIDER_METADATA.pinpointPostingsUrl, provider.pinpointPostingsUrl)
})

test('Encompass backlog row hydrates locally through the exact company name', async () => {
  const { ENCOMPASS_CATALOG } = await loadEncompassCatalog()
  const provider = hydrateProviderCatalogEntry(ENCOMPASS_CATALOG)

  assert.equal(provider.companyName, 'Encompass')
  assert.equal(provider.companyDomain, 'encompasscorporation.com')
  assert.match(provider.modulePath, /encompass[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /encompass[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Encompass\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Encompass', 'encompass', 'Encompass']],
  )
})

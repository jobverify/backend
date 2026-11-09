import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ameyo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ameyo/catalog.js')
  } catch {
    assert.fail('Expected Ameyo catalog module at ../../scraper/ameyo/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/ameyo/script.js')
  } catch {
    assert.fail('Expected Ameyo scraper module at ../../scraper/ameyo/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Ameyo local catalog captures the verified homepage 522 outage and the live Exotel careers surface', async () => {
  const { AMEYO_CATALOG } = await loadCatalogModule()
  const ameyo = await loadScraperModule()
  const provider = buildCatalogReadyProvider(AMEYO_CATALOG)

  assert.equal(provider.source, 'ameyo')
  assert.equal(provider.companyName, 'Ameyo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://exotel.com/about-us/careers/')
  assert.equal(provider.companyDomain, 'ameyo.com')
  assert.equal(provider.atsPlatform, 'recruiterbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-exotel-branded-homepage-or-verified-homepage-522-outage-plus-upstream-recruiterbox-openings-json',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exotel-branded-homepage-or-verified-homepage-522-outage+verified-exotel-careers-page+recruiterbox-openings-json',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.homepageUrl, 'https://www.ameyo.com/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://exotel.com/careers/')
  assert.equal(provider.upstreamCareersCanonicalUrl, 'https://exotel.com/about-us/careers/')
  assert.equal(provider.openingsApiUrl, 'https://app.recruiterbox.com/widget/2176/openings/')
  assert.equal(
    provider.verifiedUpstreamJobUrl,
    'https://app.recruiterbox.com/widget/2176/opening/708128/',
  )
  assert.deepEqual(provider.verifiedCareers404Urls, [
    'https://www.ameyo.com/careers/',
    'https://www.ameyo.com/jobs/',
  ])
  assert.equal(provider.upstreamCompanyName, 'Exotel Techcom Pvt Ltd')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.ameyo\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /reachable again/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/exotel\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/exotel\.com\/about-us\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /widget\/2176\/openings/i)
  assert.match(provider.verifiedSurfaceSummary, /31 India roles/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /ameyo[\\/]jobs\.json$/i)

  assert.equal(ameyo.PROVIDER_METADATA.source, provider.source)
  assert.equal(ameyo.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(ameyo.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    ameyo.PROVIDER_METADATA.officialCareersHandoffUrl,
    provider.officialCareersHandoffUrl,
  )
  assert.equal(ameyo.PROVIDER_METADATA.openingsApiUrl, provider.openingsApiUrl)
})

test('Ameyo exact backlog name matches from the local provider contract without aliases', async () => {
  const { AMEYO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Ameyo\n',
    catalog: [buildCatalogReadyProvider(AMEYO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ameyo', 'ameyo', 'Ameyo']],
  )
})

test('buildScrapers and company coverage resolve Ameyo from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ameyo')
  const scraper = buildScrapers().find((item) => item.name === 'ameyo')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Ameyo')
  assert.equal(provider.companyCareerPage, 'https://exotel.com/about-us/careers/')
  assert.match(scraper.dryRunFile, /ameyo[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Ameyo\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ameyo', 'ameyo', 'Ameyo']],
  )
})

import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dream11/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dream11/catalog.js')
  } catch {
    assert.fail('Expected Dream11 catalog module at ../../scraper/dream11/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/dream11/script.js')
  } catch {
    assert.fail('Expected Dream11 scraper module at ../../scraper/dream11/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Dream11 local catalog captures the verified parent-brand careers handoff and no-public-jobs contract', async () => {
  const { DREAM11_CATALOG } = await loadCatalogModule()
  const dream11 = await loadScraperModule()
  const provider = buildCatalogReadyProvider(DREAM11_CATALOG)

  assert.equal(provider.source, 'dream11')
  assert.equal(provider.companyName, 'Dream11')
  assert.equal(provider.officialBrandName, 'Dream11')
  assert.equal(provider.parentCompanyName, 'Dream Sports')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.dream11.com/')
  assert.equal(provider.companyCareerPage, 'https://www.dreamsports.group/careers')
  assert.equal(provider.parentCareersLandingUrl, 'https://www.dreamsports.group/lifeatdreamsports')
  assert.equal(provider.linkedCareersUrl, 'https://www.dreamsports.group/careers/')
  assert.equal(provider.parentCompanyDomain, 'dreamsports.group')
  assert.equal(provider.companyDomain, 'dream11.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-dream11-homepage-plus-parent-dream-sports-careers-handoff',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-dream11-homepage+verified-dream11-direct-careers-routes-return-home-or-404+verified-parent-dream-sports-careers-redirect+verified-parent-careers-brand-page-without-public-jobs+verified-alternate-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /dream11[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dream11\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dream11\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dreamsports\.group\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dreamsports\.group\/lifeatdreamsports/i)
  assert.match(provider.verifiedSurfaceSummary, /Game On\. Build Big\./i)
  assert.match(provider.verifiedSurfaceSummary, /LIFE AT DREAM SPORTS/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Dream11'), false)

  assert.equal(dream11.PROVIDER_METADATA.source, provider.source)
  assert.equal(dream11.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(dream11.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Dream11 backlog row matches directly from the local provider contract without aliases', async () => {
  const { DREAM11_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Dream11\n',
    catalog: [buildCatalogReadyProvider(DREAM11_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dream11', 'dream11', 'Dream11']],
  )
})

test('buildScrapers and company coverage resolve Dream11 from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dream11')
  const scraper = buildScrapers().find((item) => item.name === 'dream11')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Dream11')
  assert.equal(provider.companyCareerPage, 'https://www.dreamsports.group/careers')
  assert.match(scraper.dryRunFile, /dream11[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Dream11\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dream11', 'dream11', 'Dream11']],
  )
})

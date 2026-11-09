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
const modulePath = path.resolve(currentDir, '../../scraper/autopi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/autopi/catalog.js')
  } catch {
    assert.fail('Expected AutoPi catalog module at ../../scraper/autopi/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/autopi/script.js')
  } catch {
    assert.fail('Expected AutoPi scraper module at ../../scraper/autopi/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('AutoPi local catalog captures the verified first-party careers surface and current no-India state', async () => {
  const { AUTO_PI_CATALOG } = await loadCatalogModule()
  const autoPi = await loadScraperModule()
  const provider = buildCatalogReadyProvider(AUTO_PI_CATALOG)

  assert.equal(provider.source, 'autopi')
  assert.equal(provider.companyName, 'AutoPi')
  assert.equal(provider.officialBrandName, 'AutoPi.io')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.autopi.io/careers/')
  assert.equal(provider.homepageUrl, 'https://www.autopi.io/')
  assert.equal(provider.companyDomain, 'autopi.io')
  assert.equal(provider.applicationEmail, 'jobs@autopi.io')
  assert.equal(provider.applicationUrl, 'mailto:jobs@autopi.io')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-plus-role-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+first-party-role-cards+india-location-filter+first-party-role-detail-pages+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.deepEqual(provider.verifiedRoleUrls, [
    'https://www.autopi.io/careers/software-developer/',
    'https://www.autopi.io/careers/student-softwate-developer/',
  ])
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.autopi\.io\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.autopi\.io\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.autopi\.io\/careers\/software-developer\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.autopi\.io\/careers\/student-softwate-developer\//i)
  assert.match(provider.verifiedSurfaceSummary, /jobs@autopi\.io/i)
  assert.match(provider.verifiedSurfaceSummary, /\b2 public openings\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\bno India roles\b/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /autopi[\\/]jobs\.json$/i)

  assert.equal(autoPi.PROVIDER_METADATA.source, provider.source)
  assert.equal(autoPi.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(autoPi.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(autoPi.PROVIDER_METADATA.applicationEmail, provider.applicationEmail)
})

test('AutoPi exact backlog name matches from the local provider contract without aliases', async () => {
  const { AUTO_PI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'AutoPi\n',
    catalog: [buildCatalogReadyProvider(AUTO_PI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AutoPi', 'autopi', 'AutoPi']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'AutoPi'), false)
})

test('buildScrapers and company coverage resolve AutoPi from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'autopi')
  const scraper = buildScrapers().find((item) => item.name === 'autopi')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AutoPi')
  assert.equal(provider.companyCareerPage, 'https://www.autopi.io/careers/')
  assert.match(scraper.dryRunFile, /autopi[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AutoPi\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AutoPi', 'autopi', 'AutoPi']],
  )
})

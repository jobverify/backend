import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const aryaAiModulePath = path.resolve(currentDir, '../../scraper/aryaai/script.js')

const loadAryaAiCatalog = async () => {
  try {
    return await import('../../scraper/aryaai/catalog.js')
  } catch {
    assert.fail('Expected Arya.ai catalog module at ../../scraper/aryaai/catalog.js')
  }
}

const loadAryaAiModule = async () => {
  try {
    return await import('../../scraper/aryaai/script.js')
  } catch {
    assert.fail('Expected Arya.ai scraper module at ../../scraper/aryaai/script.js')
  }
}

test('Arya.ai local catalog captures the verified first-party homepage, careers page, and visible role card surface', async () => {
  const { ARYAAI_CATALOG } = await loadAryaAiCatalog()
  const aryaAi = await loadAryaAiModule()

  assert.equal(ARYAAI_CATALOG.source, 'aryaai')
  assert.equal(ARYAAI_CATALOG.companyName, 'Arya.ai')
  assert.equal(ARYAAI_CATALOG.officialBrandName, 'Arya.ai')
  assert.equal(ARYAAI_CATALOG.adapter, 'script')
  assert.equal(ARYAAI_CATALOG.homepageUrl, 'https://arya.ai/')
  assert.equal(ARYAAI_CATALOG.companyCareerPage, 'https://arya.ai/careers')
  assert.equal(ARYAAI_CATALOG.sitemapUrl, 'https://arya.ai/sitemap.xml')
  assert.deepEqual(ARYAAI_CATALOG.checkedMissingRouteUrls, [
    'https://arya.ai/career',
    'https://arya.ai/jobs',
    'https://arya.ai/join-us',
    'https://arya.ai/openings',
    'https://arya.ai/work-with-us',
  ])
  assert.deepEqual(ARYAAI_CATALOG.verifiedApplyUrls, [
    'https://wellfound.com/jobs/3542202-senior-data-scientist',
  ])
  assert.equal(ARYAAI_CATALOG.companyDomain, 'arya.ai')
  assert.equal(ARYAAI_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(ARYAAI_CATALOG.countryFilter, 'India')
  assert.equal(
    ARYAAI_CATALOG.paginationStrategy,
    'single-first-party-careers-page-role-card-surface',
  )
  assert.equal(
    ARYAAI_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-sitemap+verified-common-missing-routes+first-party-role-cards+external-wellfound-apply-handoff',
  )
  assert.equal(ARYAAI_CATALOG.parser, 'custom-script')
  assert.equal(ARYAAI_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ARYAAI_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(ARYAAI_CATALOG.dryRunFile, 'aryaai/jobs.json')
  assert.match(ARYAAI_CATALOG.verifiedSurfaceSummary, /https:\/\/arya\.ai\//i)
  assert.match(ARYAAI_CATALOG.verifiedSurfaceSummary, /https:\/\/arya\.ai\/careers/i)
  assert.match(ARYAAI_CATALOG.verifiedSurfaceSummary, /https:\/\/arya\.ai\/sitemap\.xml/i)
  assert.match(ARYAAI_CATALOG.verifiedSurfaceSummary, /Senior Data Scientist/i)
  assert.match(ARYAAI_CATALOG.verifiedSurfaceSummary, /Research/i)
  assert.match(ARYAAI_CATALOG.verifiedSurfaceSummary, /On-site/i)
  assert.match(ARYAAI_CATALOG.verifiedSurfaceSummary, /Full Time/i)
  assert.match(ARYAAI_CATALOG.verifiedSurfaceSummary, /https:\/\/wellfound\.com\/jobs\/3542202-senior-data-scientist/i)
  assert.equal(ARYAAI_CATALOG.modulePath, aryaAiModulePath)

  assert.equal(aryaAi.PROVIDER_METADATA.source, ARYAAI_CATALOG.source)
  assert.equal(aryaAi.PROVIDER_METADATA.companyName, ARYAAI_CATALOG.companyName)
  assert.deepEqual(aryaAi.PROVIDER_METADATA.verifiedApplyUrls, ARYAAI_CATALOG.verifiedApplyUrls)
})

test('Arya.ai backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { ARYAAI_CATALOG } = await loadAryaAiCatalog()
  const provider = hydrateProviderCatalogEntry(ARYAAI_CATALOG)

  assert.equal(provider.companyName, 'Arya.ai')
  assert.equal(provider.companyDomain, 'arya.ai')
  assert.match(provider.modulePath, /aryaai[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /aryaai[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Arya.ai'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Arya.ai\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arya.ai', 'aryaai', 'Arya.ai']],
  )
})

test('buildScrapers and company coverage resolve Arya.ai from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aryaai')
  const scraper = buildScrapers().find((item) => item.name === 'aryaai')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Arya.ai')
  assert.equal(provider.companyCareerPage, 'https://arya.ai/careers')
  assert.match(scraper.dryRunFile, /aryaai[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Arya.ai\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arya.ai', 'aryaai', 'Arya.ai']],
  )
})

import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const leenaAiModulePath = path.resolve(currentDir, '../../scraper/leenaai/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/leenaai/catalog.js')
  } catch {
    assert.fail('Expected Leena AI catalog module at ../../scraper/leenaai/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/leenaai/script.js')
  } catch {
    assert.fail('Expected Leena AI scraper module at ../../scraper/leenaai/script.js')
  }
}

test('Leena AI local catalog captures the verified first-party Explore Jobs surface', async () => {
  const { LEENA_AI_CATALOG } = await loadCatalogModule()
  const leenaAi = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LEENA_AI_CATALOG)

  assert.equal(LEENA_AI_CATALOG.source, 'leenaai')
  assert.equal(LEENA_AI_CATALOG.companyName, 'Leena AI')
  assert.equal(LEENA_AI_CATALOG.officialBrandName, 'Leena AI')
  assert.equal(LEENA_AI_CATALOG.adapter, 'script')
  assert.equal(LEENA_AI_CATALOG.modulePath, leenaAiModulePath)
  assert.equal(LEENA_AI_CATALOG.dryRunFile, 'leenaai/jobs.json')
  assert.equal(LEENA_AI_CATALOG.homepageUrl, 'https://leena.ai/')
  assert.equal(LEENA_AI_CATALOG.companyCareerPage, 'https://leena.ai/careers')
  assert.equal(LEENA_AI_CATALOG.openRolesTabUrl, 'https://leena.ai/careers?tab=explore-jobs')
  assert.equal(LEENA_AI_CATALOG.companyDomain, 'leena.ai')
  assert.equal(LEENA_AI_CATALOG.verifiedPublicJobCount, 14)
  assert.equal(LEENA_AI_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(LEENA_AI_CATALOG.countryFilter, 'India')
  assert.equal(
    LEENA_AI_CATALOG.paginationStrategy,
    'single-first-party-careers-page-static-careers-bundle',
  )
  assert.equal(
    LEENA_AI_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+static-careers-bundle-open-role-data',
  )
  assert.equal(LEENA_AI_CATALOG.parser, 'custom-script')
  assert.equal(LEENA_AI_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(LEENA_AI_CATALOG.verifiedOn, '2026-07-19')
  assert.match(LEENA_AI_CATALOG.verifiedSurfaceSummary, /Sunday, July 19, 2026/i)
  assert.match(LEENA_AI_CATALOG.verifiedSurfaceSummary, /https:\/\/leena\.ai\/careers/i)
  assert.match(LEENA_AI_CATALOG.verifiedSurfaceSummary, /careers-[a-f0-9]+\.js/i)
  assert.match(LEENA_AI_CATALOG.verifiedSurfaceSummary, /14 live India role entries/i)

  assert.equal(provider.source, 'leenaai')
  assert.equal(provider.companyName, 'Leena AI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://leena.ai/careers')
  assert.equal(provider.companyDomain, 'leena.ai')
  assert.match(provider.modulePath, /leenaai[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /leenaai[\\/]jobs\.json$/i)

  assert.equal(leenaAi.PROVIDER_METADATA.source, provider.source)
  assert.equal(leenaAi.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(leenaAi.PROVIDER_METADATA.openRolesTabUrl, LEENA_AI_CATALOG.openRolesTabUrl)
})

test('Leena AI exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { LEENA_AI_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Leena AI\n',
    catalog: [hydrateProviderCatalogEntry(LEENA_AI_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Leena AI', 'leenaai', 'Leena AI']],
  )
})

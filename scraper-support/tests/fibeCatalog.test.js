import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fibe/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fibe/catalog.js')
  } catch {
    assert.fail('Expected Fibe catalog module at ../../scraper/fibe/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/fibe/script.js')
  } catch {
    assert.fail('Expected Fibe scraper module at ../../scraper/fibe/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Fibe local catalog captures the verified first-party empty careers surface', async () => {
  const { FIBE_CATALOG } = await loadCatalogModule()
  const fibe = await loadScraperModule()
  const provider = buildCatalogReadyProvider(FIBE_CATALOG)

  assert.equal(provider.source, 'fibe')
  assert.equal(provider.companyName, 'Fibe')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.fibe.in/')
  assert.equal(provider.companyCareerPage, 'https://www.fibe.in/careers/')
  assert.equal(provider.checkedJobsRouteUrl, 'https://www.fibe.in/jobs')
  assert.equal(provider.companyDomain, 'fibe.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-empty-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-fibe-homepage-careers-link+verified-empty-fibe-careers-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fibe\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fibe\.in\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fibe\.in\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /No Jobs found/i)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /fibe[\\/]jobs\.json$/i)

  assert.equal(fibe.PROVIDER_METADATA.source, provider.source)
  assert.equal(fibe.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(fibe.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Fibe exact backlog row matches from the local provider contract without aliases', async () => {
  const { FIBE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Fibe\n',
    catalog: [buildCatalogReadyProvider(FIBE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fibe', 'fibe', 'Fibe']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Fibe'), false)
})

import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mindcraftsoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mindcraftsoftware/catalog.js')
  } catch {
    assert.fail('Expected MindCraft Software catalog module at ../../scraper/mindcraftsoftware/catalog.js')
  }
}

test('MindCraft Software local catalog captures the verified resume-submission careers shell with no public job board', async () => {
  const { MINDCRAFT_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MINDCRAFT_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, MINDCRAFT_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'mindcraftsoftware')
  assert.equal(provider.companyName, 'MindCraft Software')
  assert.equal(provider.officialBrandName, 'MindCraft')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.mindcraftamerica.com/')
  assert.equal(provider.companyCareerPage, 'https://www.mindcraftamerica.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.mindcraftamerica.com/careers/')
  assert.equal(provider.companyDomain, 'mindcraftamerica.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-shell+resume-form-without-public-role-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /mindcraftsoftware[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Apply Now/i)
  assert.match(provider.verifiedSurfaceSummary, /recruitment@mindcraft\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MindCraft Software'), false)
})

test('MindCraft Software exact backlog row matches from the local catalog entry', async () => {
  const { MINDCRAFT_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MindCraft Software\n',
    catalog: [hydrateProviderCatalogEntry(MINDCRAFT_SOFTWARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MindCraft Software', 'mindcraftsoftware', 'MindCraft Software']],
  )
})

test('MindCraft Software hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { MINDCRAFT_SOFTWARE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MINDCRAFT_SOFTWARE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.mindcraftamerica.com/careers/')
  assert.equal(provider.companyDomain, 'mindcraftamerica.com')
  assert.match(provider.modulePath, /mindcraftsoftware[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})

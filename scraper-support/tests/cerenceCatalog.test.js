import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cerence.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cerence.workday/catalog.js')
  } catch {
    assert.fail('Expected Cerence catalog module at ../../scraper/cerence.workday/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cerence.workday/script.js')
  } catch {
    assert.fail('Expected Cerence scraper module at ../../scraper/cerence.workday/script.js')
  }
}

test('Cerence local catalog captures the verified first-party careers handoff to the public Workday board', async () => {
  const { CERENCE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const cerence = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(CERENCE_CATALOG)

  assert.equal(defaultCatalog, CERENCE_CATALOG)
  assert.equal(provider.source, 'cerence')
  assert.equal(provider.companyName, 'Cerence')
  assert.equal(provider.officialBrandName, 'Cerence AI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.cerence.com/about/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.cerence.com/about/careers')
  assert.equal(provider.officialWorkdayBoardUrl, 'https://cerence.wd5.myworkdayjobs.com/Cerence')
  assert.equal(provider.companyDomain, 'cerence.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-handoff-plus-workday-india-filter')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-workday-handoff+shared-workday-runner',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.dryRunFile, /cerence.workday[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cerence\.com\/about\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/cerence\.wd5\.myworkdayjobs\.com\/Cerence/i)
  assert.match(provider.verifiedSurfaceSummary, /Research Scientist/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr High Performance Compute Engineer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Cerence'), false)

  assert.equal(cerence.PROVIDER_METADATA.source, CERENCE_CATALOG.source)
  assert.equal(cerence.PROVIDER_METADATA.companyName, CERENCE_CATALOG.companyName)
})

test('Cerence exact backlog row matches directly from local provider metadata', async () => {
  const { CERENCE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Cerence\n',
    catalog: [hydrateProviderCatalogEntry(CERENCE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Cerence', 'cerence', 'Cerence']],
  )
})

test('Cerence hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { CERENCE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CERENCE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Cerence')
  assert.equal(provider.companyCareerPage, 'https://www.cerence.com/about/careers')
  assert.equal(provider.companyDomain, 'cerence.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.match(provider.modulePath, /cerence\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /cerence.workday[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

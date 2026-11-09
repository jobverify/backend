import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/atmecsglobal/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/atmecsglobal/catalog.js')
  } catch {
    assert.fail('Expected ATMECS Global catalog module at ../../scraper/atmecsglobal/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/atmecsglobal/script.js')
  } catch {
    assert.fail('Expected ATMECS Global scraper module at ../../scraper/atmecsglobal/script.js')
  }
}

test('ATMECS Global local catalog captures the verified unavailable-host fail-closed contract', async () => {
  const { ATMECS_GLOBAL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const atmecs = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(ATMECS_GLOBAL_CATALOG)

  assert.equal(defaultCatalog, ATMECS_GLOBAL_CATALOG)
  assert.equal(provider.source, 'atmecsglobal')
  assert.equal(provider.companyName, 'ATMECS Global')
  assert.equal(provider.officialBrandName, 'ATMECS Global')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://atmecs.com/')
  assert.equal(provider.companyCareerPage, 'https://atmecs.com/jobs/')
  assert.equal(provider.officialCareersPageUrl, 'https://atmecs.com/jobs/')
  assert.equal(provider.companyDomain, 'atmecs.com')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-page-placeholder-shortcode')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-jobs-page-placeholder-shortcode-or-unavailable-host-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page-placeholder-or-unavailable-host+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-28')
  assert.match(provider.dryRunFile, /atmecsglobal[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, July 28, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/atmecs\.com\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /no longer resolves/i)
  assert.match(provider.verifiedSurfaceSummary, /returns an empty set/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'ATMECS Global'), false)

  assert.equal(atmecs.PROVIDER_METADATA.source, ATMECS_GLOBAL_CATALOG.source)
  assert.equal(atmecs.PROVIDER_METADATA.companyName, ATMECS_GLOBAL_CATALOG.companyName)
})

test('ATMECS Global exact backlog row matches directly from local provider metadata', async () => {
  const { ATMECS_GLOBAL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'ATMECS Global\n',
    catalog: [hydrateProviderCatalogEntry(ATMECS_GLOBAL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ATMECS Global', 'atmecsglobal', 'ATMECS Global']],
  )
})

test('ATMECS Global hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { ATMECS_GLOBAL_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ATMECS_GLOBAL_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'ATMECS Global')
  assert.equal(provider.companyCareerPage, 'https://atmecs.com/jobs/')
  assert.equal(provider.companyDomain, 'atmecs.com')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-page-placeholder-shortcode')
  assert.match(provider.modulePath, /atmecsglobal[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /atmecsglobal[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

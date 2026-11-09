import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tenon/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tenon/catalog.js')
  } catch {
    assert.fail('Expected Tenon catalog module at ../../scraper/tenon/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tenon/script.js')
  } catch {
    assert.fail('Expected Tenon scraper module at ../../scraper/tenon/script.js')
  }
}

test('Tenon local catalog captures the verified first-party careers handoff and Greenhouse jobs API surface', async () => {
  const { TENON_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tenon = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TENON_CATALOG)

  assert.equal(defaultCatalog, TENON_CATALOG)
  assert.equal(provider.source, 'tenon')
  assert.equal(provider.companyName, 'Tenon')
  assert.equal(provider.officialBrandName, 'Tenon')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tenonhq.com/join-us')
  assert.equal(provider.officialCareersPageUrl, 'https://www.tenonhq.com/join-us')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/tenon')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/tenon/jobs')
  assert.equal(provider.companyDomain, 'tenonhq.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-handoff-plus-greenhouse-jobs-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+current-greenhouse-board+greenhouse-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.match(provider.dryRunFile, /tenon[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, July 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tenonhq\.com\/join-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/tenon/i)
  assert.match(provider.verifiedSurfaceSummary, /boards-api\.greenhouse\.io\/v1\/boards\/tenon\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate ServiceNow Technical Consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /Indianapolis, IN/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Tenon'), false)

  assert.equal(tenon.PROVIDER_METADATA.source, TENON_CATALOG.source)
  assert.equal(tenon.PROVIDER_METADATA.companyName, TENON_CATALOG.companyName)
  assert.equal(
    tenon.PROVIDER_METADATA.greenhouseBoardUrl,
    TENON_CATALOG.greenhouseBoardUrl,
  )
})

test('Tenon exact backlog row matches directly from local provider metadata', async () => {
  const { TENON_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tenon\n',
    catalog: [hydrateProviderCatalogEntry(TENON_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tenon', 'tenon', 'Tenon']],
  )
})

test('Tenon hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { TENON_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TENON_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Tenon')
  assert.equal(provider.companyCareerPage, 'https://www.tenonhq.com/join-us')
  assert.equal(provider.companyDomain, 'tenonhq.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /tenon[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tenon[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

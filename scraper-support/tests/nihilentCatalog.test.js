import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/nihilent/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nihilent/catalog.js')
  } catch {
    assert.fail('Expected Nihilent catalog module at ../../scraper/nihilent/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/nihilent/script.js')
  } catch {
    assert.fail('Expected Nihilent scraper module at ../../scraper/nihilent/script.js')
  }
}

test('Nihilent local catalog captures the verified first-party job openings page with public role cards', async () => {
  const { NIHILENT_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const nihilent = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(NIHILENT_CATALOG)

  assert.equal(defaultCatalog, NIHILENT_CATALOG)
  assert.equal(provider.source, 'nihilent')
  assert.equal(provider.companyName, 'Nihilent')
  assert.equal(provider.officialBrandName, 'Nihilent')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.nihilent.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.nihilent.com/job-openings/')
  assert.equal(provider.companyDomain, 'nihilent.com')
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-first-party-job-openings-page+same-page-role-cards',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.dryRunFile, /nihilent[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nihilent\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nihilent\.com\/job-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /ServiceNow Lead\/ Architect/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Engineering \(MS Fabric\)/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nihilent'), false)

  assert.equal(nihilent.PROVIDER_METADATA.source, NIHILENT_CATALOG.source)
  assert.equal(nihilent.PROVIDER_METADATA.companyName, NIHILENT_CATALOG.companyName)
})

test('Nihilent exact backlog row matches directly from local provider metadata', async () => {
  const { NIHILENT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nihilent\n',
    catalog: [hydrateProviderCatalogEntry(NIHILENT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nihilent', 'nihilent', 'Nihilent']],
  )
})

test('Nihilent hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NIHILENT_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NIHILENT_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Nihilent')
  assert.equal(provider.companyCareerPage, 'https://www.nihilent.com/careers/')
  assert.equal(provider.companyDomain, 'nihilent.com')
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.match(provider.modulePath, /nihilent[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /nihilent[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

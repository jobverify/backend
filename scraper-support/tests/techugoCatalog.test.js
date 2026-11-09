import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/techugo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/techugo/catalog.js')
  } catch {
    assert.fail('Expected Techugo catalog module at ../../scraper/techugo/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/techugo/script.js')
  } catch {
    assert.fail('Expected Techugo scraper module at ../../scraper/techugo/script.js')
  }
}

test('Techugo local catalog captures the verified first-party careers and detail surfaces', async () => {
  const { TECHUGO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const techugo = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TECHUGO_CATALOG)

  assert.equal(defaultCatalog, TECHUGO_CATALOG)
  assert.equal(provider.source, 'techugo')
  assert.equal(provider.companyName, 'Techugo')
  assert.equal(provider.officialBrandName, 'Techugo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.techugo.com/career')
  assert.equal(provider.companyDomain, 'techugo.com')
  assert.equal(provider.atsPlatform, 'official-first-party-role-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-plus-linked-role-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+verified-linked-role-pages+remote-role-normalization',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /techugo[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Node\.js developer/i)
  assert.match(provider.verifiedSurfaceSummary, /QA Manual Engineer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Techugo'), false)

  assert.equal(techugo.PROVIDER_METADATA.source, TECHUGO_CATALOG.source)
  assert.equal(techugo.PROVIDER_METADATA.companyCareerPage, TECHUGO_CATALOG.companyCareerPage)
})

test('Techugo exact backlog row resolves from the local provider contract', async () => {
  const { TECHUGO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Techugo\n',
    catalog: [hydrateProviderCatalogEntry(TECHUGO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Techugo', 'techugo', 'Techugo']],
  )
})

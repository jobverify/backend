import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/unicommerceesolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/unicommerceesolutions/catalog.js')
  } catch {
    assert.fail('Expected Unicommerce Esolutions catalog module at ../../scraper/unicommerceesolutions/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/unicommerceesolutions/script.js')
  } catch {
    assert.fail('Expected Unicommerce Esolutions scraper module at ../../scraper/unicommerceesolutions/script.js')
  }
}

test('Unicommerce Esolutions local catalog captures the verified first-party current openings page', async () => {
  const { UNICOMMERCE_ESOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const unicommerce = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(UNICOMMERCE_ESOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, UNICOMMERCE_ESOLUTIONS_CATALOG)
  assert.equal(provider.source, 'unicommerceesolutions')
  assert.equal(provider.companyName, 'Unicommerce Esolutions')
  assert.equal(provider.officialBrandName, 'Unicommerce')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://services.unicommerce.com/aboutus/careers')
  assert.equal(provider.companyDomain, 'services.unicommerce.com')
  assert.equal(provider.atsPlatform, 'official-first-party-static-openings-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-current-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-current-openings-page+inline-role-descriptions',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /unicommerceesolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior\/Java Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior\/User Interface Developer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Unicommerce Esolutions'), false)

  assert.equal(unicommerce.PROVIDER_METADATA.source, UNICOMMERCE_ESOLUTIONS_CATALOG.source)
  assert.equal(unicommerce.PROVIDER_METADATA.companyCareerPage, UNICOMMERCE_ESOLUTIONS_CATALOG.companyCareerPage)
})

test('Unicommerce Esolutions exact backlog row resolves from the local provider contract', async () => {
  const { UNICOMMERCE_ESOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Unicommerce Esolutions\n',
    catalog: [hydrateProviderCatalogEntry(UNICOMMERCE_ESOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Unicommerce Esolutions', 'unicommerceesolutions', 'Unicommerce Esolutions']],
  )
})

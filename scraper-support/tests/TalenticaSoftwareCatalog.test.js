import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/talenticasoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/talenticasoftware/catalog.js')
  } catch {
    assert.fail('Expected Talentica Software catalog module at ../../scraper/talenticasoftware/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/talenticasoftware/script.js')
  } catch {
    assert.fail('Expected Talentica Software scraper module at ../../scraper/talenticasoftware/script.js')
  }
}

test('Talentica Software local catalog captures the verified first-party job card grid', async () => {
  const { TALENTICA_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const talentica = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TALENTICA_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, TALENTICA_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'talenticasoftware')
  assert.equal(provider.companyName, 'Talentica Software')
  assert.equal(provider.officialBrandName, 'Talentica')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.talentica.com/careers/')
  assert.equal(provider.companyCareerPage, 'https://www.talentica.com/job-openings/')
  assert.equal(provider.atsPlatform, 'official-company-native-role-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'paired-current-index-and-declared-role-pages;company-scope-unqualified')
  assert.equal(
    provider.extractionStrategy,
    'active-own-role-criteria+application-position-fields;native-country-unproven',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'talentica.com')
  assert.equal(provider.verifiedOn, '2026-11-05')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Work-country.*remain unknown/i)
  assert.match(provider.verifiedSurfaceSummary, /activation and cleanup are unqualified/i)
  assert.equal(talentica.PROVIDER_METADATA.source, provider.source)
})

test('Talentica Software exact backlog row resolves from the local catalog without aliases', async () => {
  const { TALENTICA_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Talentica Software\n',
    catalog: [hydrateProviderCatalogEntry(TALENTICA_SOFTWARE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Talentica Software', 'talenticasoftware', 'Talentica Software']],
  )
})

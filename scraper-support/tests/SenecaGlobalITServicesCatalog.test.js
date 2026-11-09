import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/senecaglobalitservices/script.js')

const aliasMap = {
  SenecaGlobal: 'senecaglobalitservices',
  'SenecaGlobal IT Services Private Limited': 'senecaglobalitservices',
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/senecaglobalitservices/catalog.js')
  } catch {
    assert.fail('Expected Seneca Global IT Services catalog module at ../../scraper/senecaglobalitservices/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/senecaglobalitservices/script.js')
  } catch {
    assert.fail('Expected Seneca Global IT Services scraper module at ../../scraper/senecaglobalitservices/script.js')
  }
}

test('Seneca Global IT Services local catalog captures the verified India careers page and same-domain detail pages', async () => {
  const { SENECA_GLOBAL_IT_SERVICES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const seneca = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SENECA_GLOBAL_IT_SERVICES_CATALOG)

  assert.equal(defaultCatalog, SENECA_GLOBAL_IT_SERVICES_CATALOG)
  assert.equal(provider.source, 'senecaglobalitservices')
  assert.equal(provider.companyName, 'Seneca Global IT Services')
  assert.equal(provider.officialBrandName, 'SenecaGlobal IT Services Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.senecaglobal.com/careers/india-careers/')
  assert.deepEqual(provider.verifiedJobDetailUrls, [
    'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    'https://www.senecaglobal.com/india-careers/senior-web-publisher/',
  ])
  assert.equal(provider.companyDomain, 'senecaglobal.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-job-list-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-india-careers-page+same-domain-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /senecaglobalitservices[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /india-careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior QA Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Web Publisher/i)
  assert.equal(companyAliases.SenecaGlobal, 'senecaglobalitservices')
  assert.equal(companyAliases['SenecaGlobal IT Services Private Limited'], 'senecaglobalitservices')

  assert.equal(seneca.PROVIDER_METADATA.source, SENECA_GLOBAL_IT_SERVICES_CATALOG.source)
  assert.equal(seneca.PROVIDER_METADATA.companyCareerPage, SENECA_GLOBAL_IT_SERVICES_CATALOG.companyCareerPage)
})

test('Seneca Global IT Services local coverage contract documents the exact alias snippet the controller should later integrate', async () => {
  const { SENECA_GLOBAL_IT_SERVICES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Seneca Global IT Services\nSenecaGlobal\nSenecaGlobal IT Services Private Limited\n',
    catalog: [hydrateProviderCatalogEntry(SENECA_GLOBAL_IT_SERVICES_CATALOG)],
    aliasMap,
  })

  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Seneca Global IT Services', 'senecaglobalitservices', 'Seneca Global IT Services'],
      ['SenecaGlobal', 'senecaglobalitservices', 'Seneca Global IT Services'],
      ['SenecaGlobal IT Services Private Limited', 'senecaglobalitservices', 'Seneca Global IT Services'],
    ],
  )
})

test('Seneca Global IT Services hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { SENECA_GLOBAL_IT_SERVICES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SENECA_GLOBAL_IT_SERVICES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Seneca Global IT Services')
  assert.match(provider.modulePath, /senecaglobalitservices[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /senecaglobalitservices[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

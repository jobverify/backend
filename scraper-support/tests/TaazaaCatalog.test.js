import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/taazaa/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/taazaa/catalog.js')
  } catch {
    assert.fail('Expected TAAZAA catalog module at ../../scraper/taazaa/catalog.js')
  }
}

test('TAAZAA local catalog captures the verified first-party careers page and public Keka jobs API metadata', async () => {
  const { TAAZAA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TAAZAA_CATALOG)

  assert.equal(defaultCatalog, TAAZAA_CATALOG)
  assert.equal(provider.source, 'taazaa')
  assert.equal(provider.companyName, 'TAAZAA')
  assert.equal(provider.officialBrandName, 'Taazaa')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.taazaa.com/')
  assert.equal(provider.companyCareerPage, 'https://www.taazaa.com/about-us/careers')
  assert.equal(provider.officialKekaBoardUrl, 'https://taazaa.keka.com/careers/')
  assert.equal(provider.publicJobsApiUrl, 'https://taazaa.keka.com/careers/api/jobs/default/active')
  assert.equal(provider.expectedIdentifier, 'caf439a8-817a-46f5-917f-c6aef6ab6beb')
  assert.equal(provider.companyDomain, 'taazaa.com')
  assert.equal(provider.atsPlatform, 'keka-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-first-party-page-plus-single-keka-active-jobs-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-embedded-keka-config+careerportalinfo+active-keka-jobs-api+jobdetails+applyjob',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /taazaa[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /caf439a8-817a-46f5-917f-c6aef6ab6beb/i)
  assert.match(provider.verifiedSurfaceSummary, /taazaa\.keka\.com\/careers\/api\/jobs\/default\/active/i)
})

test('TAAZAA exact backlog row matches directly from local provider metadata', async () => {
  const { TAAZAA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TAAZAA\n',
    catalog: [hydrateProviderCatalogEntry(TAAZAA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TAAZAA', 'taazaa', 'TAAZAA']],
  )
})

test('TAAZAA hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { TAAZAA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TAAZAA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TAAZAA')
  assert.equal(provider.companyDomain, 'taazaa.com')
  assert.equal(provider.atsPlatform, 'keka-jobs-api')
  assert.match(provider.modulePath, /taazaa[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /taazaa[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

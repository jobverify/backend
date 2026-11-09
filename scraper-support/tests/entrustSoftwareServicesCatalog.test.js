import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/entrustsoftwareservices/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/entrustsoftwareservices/catalog.js')
  } catch {
    assert.fail('Expected eNTrust Software & Services catalog module at ../../scraper/entrustsoftwareservices/catalog.js')
  }
}

test('eNTrust Software & Services local catalog captures the verified no-public-careers homepage contract', async () => {
  const {
    ENTRUST_SOFTWARE_SERVICES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ENTRUST_SOFTWARE_SERVICES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(defaultCatalog, ENTRUST_SOFTWARE_SERVICES_CATALOG)
  assert.equal(provider.source, 'entrustsoftwareservices')
  assert.equal(provider.companyName, 'eNTrust Software & Services')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.entrustsoft.in/')
  assert.equal(provider.companyCareerPage, 'https://www.entrustsoft.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-without-careers-navigation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+contact-signals+no-careers-navigation-or-public-jobs-return-empty',
  )
  assert.equal(provider.companyDomain, 'entrustsoft.in')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Get in touch/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /entrustsoftwareservices[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

test('eNTrust Software & Services exact backlog row resolves from the local provider metadata without aliases', async () => {
  const { ENTRUST_SOFTWARE_SERVICES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'eNTrust Software & Services\n',
    catalog: [hydrateProviderCatalogEntry(ENTRUST_SOFTWARE_SERVICES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['eNTrust Software & Services', 'entrustsoftwareservices', 'eNTrust Software & Services']],
  )
})

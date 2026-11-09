import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/yalamanchilisoftwareexports/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/yalamanchilisoftwareexports/catalog.js')
  } catch {
    assert.fail('Expected Yalamanchili Software Exports catalog module at ../../scraper/yalamanchilisoftwareexports/catalog.js')
  }
}

test('Yalamanchili Software Exports local catalog captures the exact-name sentinel state', async () => {
  const { YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG)

  assert.equal(defaultCatalog, YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG)
  assert.equal(provider.source, 'yalamanchilisoftwareexports')
  assert.equal(provider.companyName, 'Yalamanchili Software Exports')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.ysppayments.com/')
  assert.equal(provider.companyDomain, 'ysppayments.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.paginationStrategy, 'legacy-domain-redirect-plus-current-brand-homepage-plus-common-careers-route-404-validation')
  assert.equal(provider.extractionStrategy, 'verified-current-brand-homepage-without-public-jobs+common-careers-route-404-validation-return-empty')
  assert.equal(provider.verifiedOn, '2026-08-06')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /ysppayments\.com/i)
})

test('Yalamanchili Software Exports exact backlog row matches from the local catalog entry', async () => {
  const { YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Yalamanchili Software Exports\n',
    catalog: [hydrateProviderCatalogEntry(YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Yalamanchili Software Exports hydrated local catalog stays script-runner compatible', async () => {
  const { YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.match(provider.modulePath, /yalamanchilisoftwareexports[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})

test('Yalamanchili Software Exports shared provider catalog stays aligned with the verified local catalog', async () => {
  const { YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG } = await loadCatalogModule()
  const catalogProvider = getScraperCatalog().find((item) => item.source === 'yalamanchilisoftwareexports')
  const scraper = buildScrapers().find((item) => item.name === 'yalamanchilisoftwareexports')

  assert.ok(catalogProvider, 'Expected Yalamanchili Software Exports in customProviders.json')
  assert.equal(catalogProvider.companyCareerPage, YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG.companyCareerPage)
  assert.equal(catalogProvider.companyDomain, YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG.companyDomain)
  assert.equal(catalogProvider.paginationStrategy, YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG.paginationStrategy)
  assert.equal(catalogProvider.extractionStrategy, YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG.extractionStrategy)
  assert.equal(catalogProvider.verifiedOn, YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG.verifiedOn)
  assert.match(catalogProvider.verifiedSurfaceSummary, /ysppayments\.com/i)

  assert.ok(scraper, 'Expected buildScrapers() to return the Yalamanchili Software Exports scraper')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ysppayments.com/')
  assert.equal(scraper.provider.companyDomain, 'ysppayments.com')
  assert.match(scraper.dryRunFile, /yalamanchilisoftwareexports[\\/]jobs\.json$/i)
})

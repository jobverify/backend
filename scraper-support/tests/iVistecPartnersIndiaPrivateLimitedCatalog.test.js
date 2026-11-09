import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ivistecpartnersindiaprivatelimited/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ivistecpartnersindiaprivatelimited/catalog.js')
  } catch {
    assert.fail(
      'Expected iVistec Partners India Private Limited catalog module at ../../scraper/ivistecpartnersindiaprivatelimited/catalog.js',
    )
  }
}

test('iVistec Partners India Private Limited local catalog captures the verified no-careers sentinel contract on August 2, 2026', async () => {
  const { IVISTEC_PARTNERS_INDIA_PRIVATE_LIMITED_CATALOG, default: defaultCatalog } =
    await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(IVISTEC_PARTNERS_INDIA_PRIVATE_LIMITED_CATALOG)

  assert.equal(defaultCatalog, IVISTEC_PARTNERS_INDIA_PRIVATE_LIMITED_CATALOG)
  assert.equal(provider.source, 'ivistecpartnersindiaprivatelimited')
  assert.equal(provider.companyName, 'iVistec Partners India Private Limited')
  assert.equal(provider.officialBrandName, 'Vistec Partners')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://vistecpartners.com/Index.html')
  assert.equal(provider.companyCareerPage, 'https://vistecpartners.com/Index.html')
  assert.equal(provider.companyDomain, 'vistecpartners.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-about-contact-verification')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about+verified-contact+no-first-party-careers-surface',
  )
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Noida office/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('iVistec Partners India Private Limited exact backlog row resolves from the local catalog contract', async () => {
  const { IVISTEC_PARTNERS_INDIA_PRIVATE_LIMITED_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'iVistec Partners India Private Limited\n',
    catalog: [hydrateProviderCatalogEntry(IVISTEC_PARTNERS_INDIA_PRIVATE_LIMITED_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

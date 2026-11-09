import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/perpetuuititechnosoftservices/catalog.js')
  } catch {
    assert.fail('Expected Perpetuuiti Technosoft Services catalog module at ../../scraper/perpetuuititechnosoftservices/catalog.js')
  }
}

test('Perpetuuiti Technosoft Services local catalog captures the verified redirected no-public-careers surface', async () => {
  const {
    PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG)

  assert.equal(defaultCatalog, PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG)
  assert.equal(provider.source, 'perpetuuititechnosoftservices')
  assert.equal(provider.companyName, 'Perpetuuiti Technosoft Services')
  assert.equal(provider.officialBrandName, 'Perpetuuiti')
  assert.equal(provider.homepageUrl, 'https://ptechnosoft.com/')
  assert.equal(provider.companyCareerPage, 'https://ptechnosoft.com/')
  assert.equal(provider.companyDomain, 'ptechnosoft.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /perpetuuiti\.com\/Careers\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /ptechnosoft\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /No trustworthy public first-party jobs surface/i)
})

test('Perpetuuiti Technosoft Services backlog row matches directly through the local catalog', async () => {
  const { PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Perpetuuiti Technosoft Services\n',
    catalog: [hydrateProviderCatalogEntry(PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => item.source), ['perpetuuititechnosoftservices'])
})

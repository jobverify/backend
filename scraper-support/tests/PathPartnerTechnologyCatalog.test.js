import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pathpartnertechnology/catalog.js')
  } catch {
    assert.fail('Expected PathPartner Technology catalog module at ../../scraper/pathpartnertechnology/catalog.js')
  }
}

test('PathPartner Technology local catalog captures the verified no-public-careers or trusted-host-unavailable sentinel', async () => {
  const { PATHPARTNER_TECHNOLOGY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PATHPARTNER_TECHNOLOGY_CATALOG)

  assert.equal(defaultCatalog, PATHPARTNER_TECHNOLOGY_CATALOG)
  assert.equal(provider.source, 'pathpartnertechnology')
  assert.equal(provider.companyName, 'PathPartner Technology')
  assert.equal(provider.homepageUrl, 'https://pathpartnertech.com/')
  assert.equal(provider.companyCareerPage, 'https://pathpartnertech.com/about/')
  assert.equal(provider.companyDomain, 'pathpartnertech.com')
  assert.equal(provider.atsPlatform, 'official-company-site-unavailable-no-public-jobs')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /ECONNRESET/i)
  assert.match(provider.verifiedSurfaceSummary, /page-sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /zero-job sentinel|no trustworthy public jobs surface/i)
})

test('PathPartner Technology backlog row matches directly through the local catalog', async () => {
  const { PATHPARTNER_TECHNOLOGY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'PathPartner Technology\n',
    catalog: [hydrateProviderCatalogEntry(PATHPARTNER_TECHNOLOGY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => item.source), ['pathpartnertechnology'])
})

import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/brigoshatechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/brigoshatechnologies/catalog.js')
  } catch {
    assert.fail('Expected Brigosha Technologies catalog module at ../../scraper/brigoshatechnologies/catalog.js')
  }
}

test('Brigosha Technologies local catalog captures the verified first-party join-us handoff and fail-closed portal state', async () => {
  const { BRIGOSHA_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(BRIGOSHA_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, BRIGOSHA_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'brigoshatechnologies')
  assert.equal(provider.companyName, 'Brigosha Technologies')
  assert.equal(provider.officialBrandName, 'brigosha Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.brigosha.com/join-us/')
  assert.equal(provider.companyDomain, 'brigosha.com')
  assert.equal(provider.officialCareersPageUrl, 'https://www.brigosha.com/join-us/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://login.brigosha.com/')
  assert.equal(provider.atsPlatform, 'associate-portal-handoff-unverifiable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'join-us-page-plus-js-only-associate-portal')
  assert.equal(provider.extractionStrategy, 'verified-first-party-join-us-page+verified-portal-handoff+fail-closed-sentinel')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /brigoshatechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.brigosha\.com\/join-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/login\.brigosha\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Brigosha Technologies exact backlog row resolves from the local provider contract', async () => {
  const { BRIGOSHA_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Brigosha Technologies\n',
    catalog: [hydrateProviderCatalogEntry(BRIGOSHA_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Brigosha Technologies', 'brigoshatechnologies', 'Brigosha Technologies']],
  )
})

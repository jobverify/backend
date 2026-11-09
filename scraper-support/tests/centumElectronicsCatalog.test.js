import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/centumelectronics/catalog.js')
  } catch {
    assert.fail('Expected Centum Electronics catalog module at ../../scraper/centumelectronics/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/centumelectronics/script.js')
  } catch {
    assert.fail('Expected Centum Electronics scraper module at ../../scraper/centumelectronics/script.js')
  }
}

test('getScraperCatalog includes Centum Electronics as a verified broken-handoff sentinel', async () => {
  const centumCatalog = await loadCatalogModule()
  const centum = await loadScriptModule()
  const provider = getScraperCatalog().find((item) => item.source === 'centumelectronics')

  assert.ok(provider)
  assert.equal(provider.source, 'centumelectronics')
  assert.equal(provider.companyName, 'Centum Electronics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.centumelectronics.com/')
  assert.equal(provider.companyDomain, 'centumelectronics.com')
  assert.equal(provider.atsPlatform, 'official-homepage-with-broken-india-careers-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-unresolved-first-party-india-careers-host-and-common-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-centum-homepage+unresolved-first-party-india-careers-host-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /centumelectronics[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /centumelectronics[\\/]jobs\.json$/i)
  assert.equal(centum.VERIFIED_ON, '2026-07-14')
  assert.match(centum.VERIFIED_SURFACE_SUMMARY, /did not resolve publicly/i)
  assert.equal(centumCatalog.CENTUM_ELECTRONICS_CATALOG.source, provider.source)
  assert.equal(centumCatalog.CENTUM_ELECTRONICS_CATALOG.companyName, provider.companyName)
  assert.equal(centumCatalog.CENTUM_ELECTRONICS_CATALOG.companyCareerPage, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Centum Electronics from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'centumelectronics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'centumelectronics')
  assert.match(scraper.dryRunFile, /centumelectronics[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Centum Electronics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Centum Electronics', 'centumelectronics', 'Centum Electronics']],
  )
})

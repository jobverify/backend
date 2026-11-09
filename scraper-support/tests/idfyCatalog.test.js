import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/idfy/catalog.js')
  } catch {
    assert.fail('Expected IDfy catalog module at ../../scraper/idfy/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/idfy/script.js')
  } catch {
    assert.fail('Expected IDfy scraper module at ../../scraper/idfy/script.js')
  }
}

test('IDfy local catalog captures the verified official TurboHire handoff and public feed', async () => {
  const { IDFY_CATALOG } = await loadCatalogModule()
  const idfy = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(IDFY_CATALOG)

  assert.equal(provider.source, 'idfy')
  assert.equal(provider.companyName, 'IDfy')
  assert.equal(provider.officialBrandName, 'IDfy')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.idfy.com/careers/')
  assert.equal(
    provider.handoffBoardUrl,
    'https://idfy.turbohire.co/careerpage/e73676a8-bc5a-4b43-b9c6-d3fc7a60b572',
  )
  assert.equal(provider.turboHireOrgId, 'e73676a8-bc5a-4b43-b9c6-d3fc7a60b572')
  assert.equal(provider.companyDomain, 'idfy.com')
  assert.equal(provider.atsPlatform, 'turbohire')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedLiveJobCount, 14)
  assert.equal(provider.verifiedIndiaSampleTitle, 'Module Lead - DevOps')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-page-handoff-plus-public-turbohire-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page-redirect+turbohire-board+noauth-token+filteredjobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.idfy\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/idfy\.turbohire\.co\/careerpage\/e73676a8-bc5a-4b43-b9c6-d3fc7a60b572/i)
  assert.match(provider.verifiedSurfaceSummary, /14 public jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Module Lead - DevOps/i)
  assert.match(provider.modulePath, /idfy[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /idfy[\\/]jobs\.json$/i)

  assert.equal(idfy.PROVIDER_METADATA.source, provider.source)
  assert.equal(idfy.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(idfy.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(idfy.PROVIDER_METADATA.handoffBoardUrl, provider.handoffBoardUrl)
})

test('IDfy exact backlog row matches from the local provider contract without aliases', async () => {
  const { IDFY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'IDfy\n',
    catalog: [hydrateProviderCatalogEntry(IDFY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IDfy', 'idfy', 'IDfy']],
  )
})

test('getScraperCatalog includes IDfy as a verified TurboHire provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'idfy')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IDfy')
  assert.equal(provider.companyCareerPage, 'https://www.idfy.com/careers/')
  assert.equal(provider.companyDomain, 'idfy.com')
  assert.equal(provider.atsPlatform, 'turbohire')
  assert.match(provider.modulePath, /idfy[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable IDfy scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'idfy')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'idfy')
  assert.equal(scraper.provider.atsPlatform, 'turbohire')
  assert.match(scraper.dryRunFile, /idfy[\\/]jobs\.json$/i)
})

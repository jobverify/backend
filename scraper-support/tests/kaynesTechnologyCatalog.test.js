import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kaynestechnology/catalog.js')
  } catch {
    assert.fail('Expected Kaynes Technology catalog module at ../../scraper/kaynestechnology/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kaynestechnology/script.js')
  } catch {
    assert.fail('Expected Kaynes Technology scraper module at ../../scraper/kaynestechnology/script.js')
  }
}

test('Kaynes Technology local catalog captures the verified first-party empty-board sentinel contract', async () => {
  const { KAYNES_TECHNOLOGY_CATALOG } = await loadCatalogModule()
  const kaynesTechnology = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KAYNES_TECHNOLOGY_CATALOG)

  assert.equal(KAYNES_TECHNOLOGY_CATALOG.source, 'kaynestechnology')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.companyName, 'Kaynes Technology')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.officialBrandName, 'Kaynes Technology India Limited')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.adapter, 'script')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.modulePath, '../../scraper/kaynestechnology/script.js')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.dryRunFile, 'kaynestechnology/jobs.json')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.homepageUrl, 'https://www.kaynestechnology.co.in/index.html')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.companyCareerPage, 'https://www.kaynestechnology.co.in/index.html')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.companyDomain, 'kaynestechnology.co.in')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.atsPlatform, 'official-company-careers-empty-board')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.countryFilter, 'India')
  assert.equal(
    KAYNES_TECHNOLOGY_CATALOG.paginationStrategy,
    'homepage-plus-adjacent-route-404-validation',
  )
  assert.equal(
    KAYNES_TECHNOLOGY_CATALOG.extractionStrategy,
    'verified-homepage+missing-common-careers-routes-return-empty',
  )
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.parser, 'custom-script')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KAYNES_TECHNOLOGY_CATALOG.verifiedOn, '2026-07-16')
  assert.match(KAYNES_TECHNOLOGY_CATALOG.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(KAYNES_TECHNOLOGY_CATALOG.verifiedSurfaceSummary, /kaynestechnology\.co\.in\/index\.html/i)
  assert.match(KAYNES_TECHNOLOGY_CATALOG.verifiedSurfaceSummary, /recruitment fraud/i)
  assert.match(KAYNES_TECHNOLOGY_CATALOG.verifiedSurfaceSummary, /404/i)
  assert.match(KAYNES_TECHNOLOGY_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(provider.source, 'kaynestechnology')
  assert.equal(provider.companyName, 'Kaynes Technology')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.kaynestechnology.co.in/index.html')
  assert.equal(provider.companyDomain, 'kaynestechnology.co.in')
  assert.match(provider.modulePath, /kaynestechnology[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /kaynestechnology[\\/]jobs\.json$/i)

  assert.equal(kaynesTechnology.PROVIDER_METADATA.source, provider.source)
  assert.equal(kaynesTechnology.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(kaynesTechnology.CAREERS_URL, provider.companyCareerPage)
})

test('Kaynes Technology exact-name backlog rows resolve directly from local metadata without a shared alias', async () => {
  const { KAYNES_TECHNOLOGY_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Kaynes Technology\n',
    catalog: [hydrateProviderCatalogEntry(KAYNES_TECHNOLOGY_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kaynes Technology', 'kaynestechnology', 'Kaynes Technology']],
  )
})

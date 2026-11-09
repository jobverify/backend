import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/7edgesolutions/catalog.js')
  } catch {
    assert.fail('Expected 7Edge Solutions catalog module at ../../scraper/7edgesolutions/catalog.js')
  }
}

test('7Edge Solutions catalog captures the verified homepage-to-Keka real scraper metadata', async () => {
  const sevenEdgeCatalog = await loadCatalogModule()

  assert.deepEqual(sevenEdgeCatalog.SEVEN_EDGE_SOLUTIONS_CATALOG, {
    source: '7edgesolutions',
    companyName: '7Edge Solutions',
    companyCareerPage: 'https://7edge.com/',
    companyDomain: '7edge.com',
    adapter: 'script',
    atsPlatform: 'keka-embed-api',
    countryFilter: 'India',
    paginationStrategy: 'official-homepage-handoff-plus-single-keka-active-jobs-endpoint',
    extractionStrategy: 'verified-official-homepage+verified-keka-handoff+embedded-khConfig+careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    modulePath: 'scraper/7edgesolutions/script.js',
    verifiedOn: '2026-07-14',
    verifiedSurfaceSummary: 'Official 7edge.com homepage links Careers to a public 7edge.keka.com careers page whose embedded khConfig and active jobs feed expose India roles.',
    externalHandoffUrl: 'https://7edge.keka.com/careers/',
    expectedIdentifier: '47717352-59ee-46c3-9b43-ac709b076550',
    expectedKekaDomain: 'https://7edge.keka.com/careers/',
  })
})

test('buildScrapers and company coverage resolve 7Edge Solutions from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === '7edgesolutions')
  const scraper = buildScrapers().find((item) => item.name === '7edgesolutions')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, '7Edge Solutions')
  assert.equal(provider.companyCareerPage, 'https://7edge.com/')
  assert.match(scraper.dryRunFile, /7edgesolutions[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: '7Edge Solutions\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['7Edge Solutions', '7edgesolutions', '7Edge Solutions']],
  )
})

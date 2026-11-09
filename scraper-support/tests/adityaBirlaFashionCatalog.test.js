import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAdityaBirlaFashionCatalog = async () => {
  try {
    return await import('../../scraper/adityabirlafashion/catalog.js')
  } catch {
    assert.fail('Expected Aditya Birla Fashion catalog module at ../../scraper/adityabirlafashion/catalog.js')
  }
}

test('Aditya Birla Fashion catalog captures the runtime-only ABFRL sector and unresolved employer scope without a shared alias', async () => {
  const {
    ADITYA_BIRLA_FASHION_CATALOG,
    default: defaultCatalog,
  } = await loadAdityaBirlaFashionCatalog()

  assert.equal(defaultCatalog, ADITYA_BIRLA_FASHION_CATALOG)
  assert.equal(ADITYA_BIRLA_FASHION_CATALOG.source, 'adityabirlafashion')
  assert.equal(ADITYA_BIRLA_FASHION_CATALOG.companyName, 'Aditya Birla Fashion')
  assert.equal(
    ADITYA_BIRLA_FASHION_CATALOG.officialBrandName,
    'Aditya Birla Fashion and Retail',
  )
  assert.equal(ADITYA_BIRLA_FASHION_CATALOG.companyCareerPage, 'https://www.abfrl.com/careers/')
  assert.equal(ADITYA_BIRLA_FASHION_CATALOG.companyDomain, 'abfrl.com')
  assert.equal(
    ADITYA_BIRLA_FASHION_CATALOG.officialCareersHandoffUrl,
    'https://careers.adityabirla.com/fashion-retail',
  )
  assert.equal(
    ADITYA_BIRLA_FASHION_CATALOG.storeManagerOpeningsUrl,
    'https://abfrlcareers.peoplestrong.com/home',
  )
  assert.equal(ADITYA_BIRLA_FASHION_CATALOG.atsPlatform, "official-aditya-birla-native-api")
  assert.equal(ADITYA_BIRLA_FASHION_CATALOG.countryFilter, 'India')
  assert.equal(
    ADITYA_BIRLA_FASHION_CATALOG.paginationStrategy,
    "native-sector-page-index-terminal-page-and-closing-criteria-comparison-with-independent-store-scope",
  )
  assert.equal(
    ADITYA_BIRLA_FASHION_CATALOG.extractionStrategy,
    "current-corporate-handoffs+hydrated-sector-api+explicit-native-employer-binding+full-criteria+unresolved-sector-records-retained",
  )
  assert.equal(ADITYA_BIRLA_FASHION_CATALOG.parser, 'custom-script')
  assert.equal(ADITYA_BIRLA_FASHION_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ADITYA_BIRLA_FASHION_CATALOG.verifiedOn, null)
  assert.match(ADITYA_BIRLA_FASHION_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.abfrl\.com\/careers\//)
  assert.match(ADITYA_BIRLA_FASHION_CATALOG.verifiedSurfaceSummary, /https:\/\/careers\.adityabirla\.com\/fashion-retail/)
  assert.match(ADITYA_BIRLA_FASHION_CATALOG.verifiedSurfaceSummary, /https:\/\/careers\.adityabirla\.com\/job-search/)
  assert.match(ADITYA_BIRLA_FASHION_CATALOG.verifiedSurfaceSummary, /https:\/\/abfrlcareers\.peoplestrong\.com\/home/)
  assert.match(ADITYA_BIRLA_FASHION_CATALOG.modulePath, /adityabirlafashion[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aditya Birla Fashion'), false)
})

test('Aditya Birla Fashion backlog matching works directly from the local catalog metadata', async () => {
  const { ADITYA_BIRLA_FASHION_CATALOG } = await loadAdityaBirlaFashionCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Aditya Birla Fashion,\n',
    catalog: [ADITYA_BIRLA_FASHION_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aditya Birla Fashion', 'adityabirlafashion', 'Aditya Birla Fashion']],
  )
})

test('buildScrapers and company coverage resolve Aditya Birla Fashion from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'adityabirlafashion')
  const scraper = buildScrapers().find((item) => item.name === 'adityabirlafashion')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aditya Birla Fashion')
  assert.equal(provider.companyCareerPage, 'https://www.abfrl.com/careers/')
  assert.match(scraper.dryRunFile, /adityabirlafashion[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aditya Birla Fashion\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aditya Birla Fashion', 'adityabirlafashion', 'Aditya Birla Fashion']],
  )
})

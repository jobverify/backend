import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/glandpharma/catalog.js')
  } catch {
    assert.fail('Expected Gland Pharma catalog module at ../../scraper/glandpharma/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/glandpharma/script.js')
  } catch {
    assert.fail('Expected Gland Pharma scraper module at ../../scraper/glandpharma/script.js')
  }
}

test('Gland Pharma local catalog captures the verified first-party empty-board sentinel contract', async () => {
  const { GLAND_PHARMA_CATALOG } = await loadCatalogModule()
  const glandPharma = await loadScriptModule()

  assert.equal(GLAND_PHARMA_CATALOG.source, 'glandpharma')
  assert.equal(GLAND_PHARMA_CATALOG.companyName, 'Gland Pharma')
  assert.equal(GLAND_PHARMA_CATALOG.officialBrandName, 'Gland Pharma Limited')
  assert.equal(GLAND_PHARMA_CATALOG.adapter, 'script')
  assert.equal(GLAND_PHARMA_CATALOG.homepageUrl, 'https://glandpharma.com/')
  assert.equal(GLAND_PHARMA_CATALOG.companyCareerPage, 'https://glandpharma.com/careers')
  assert.equal(GLAND_PHARMA_CATALOG.companyDomain, 'glandpharma.com')
  assert.equal(GLAND_PHARMA_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(GLAND_PHARMA_CATALOG.countryFilter, 'India')
  assert.equal(
    GLAND_PHARMA_CATALOG.paginationStrategy,
    'verified-homepage-plus-careers-shell-route-validation',
  )
  assert.equal(
    GLAND_PHARMA_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-shell-routes-without-public-listings-return-empty',
  )
  assert.equal(GLAND_PHARMA_CATALOG.parser, 'custom-script')
  assert.equal(GLAND_PHARMA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GLAND_PHARMA_CATALOG.modulePath, '../../scraper/glandpharma/script.js')
  assert.equal(GLAND_PHARMA_CATALOG.dryRunFile, 'glandpharma/jobs.json')
  assert.equal(GLAND_PHARMA_CATALOG.verifiedOn, '2026-07-16')
  assert.match(GLAND_PHARMA_CATALOG.verifiedSurfaceSummary, /glandpharma\.com\/careers/i)
  assert.match(GLAND_PHARMA_CATALOG.verifiedSurfaceSummary, /no trustworthy public job listings/i)

  assert.equal(glandPharma.PROVIDER_METADATA.source, GLAND_PHARMA_CATALOG.source)
  assert.equal(glandPharma.HOMEPAGE_URL, GLAND_PHARMA_CATALOG.homepageUrl)
  assert.equal(glandPharma.CAREERS_URL, GLAND_PHARMA_CATALOG.companyCareerPage)
})

test('Gland Pharma exact-name and legal-name backlog rows resolve directly from local provider metadata', async () => {
  const { GLAND_PHARMA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Gland Pharma\nGland Pharma Limited\n',
    catalog: [GLAND_PHARMA_CATALOG],
    aliasMap: {
      'Gland Pharma Limited': 'glandpharma',
    },
  })

  assert.equal(report.totalRows, 2)
  assert.equal(report.candidateRows, 2)
  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Gland Pharma', 'glandpharma', 'Gland Pharma'],
      ['Gland Pharma Limited', 'glandpharma', 'Gland Pharma'],
    ],
  )
})

test('getScraperCatalog includes Gland Pharma as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'glandpharma')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Gland Pharma')
  assert.equal(provider.companyCareerPage, 'https://glandpharma.com/careers')
  assert.equal(provider.companyDomain, 'glandpharma.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /glandpharma[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Gland Pharma scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'glandpharma')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'glandpharma')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /glandpharma[\\/]jobs\.json$/i)
})

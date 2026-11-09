import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadNiramaiModule = async () => {
  try {
    return await import('../../scraper/niramai/script.js')
  } catch {
    return null
  }
}

test('Niramai exports verified first-party metadata for the live jobs archive', async () => {
  const niramai = await loadNiramaiModule()
  assert.ok(niramai, 'Expected Niramai scraper module at ../../scraper/niramai/script.js')

  assert.equal(niramai.SOURCE, 'niramai')
  assert.equal(niramai.COMPANY, 'Niramai')
  assert.equal(niramai.COMPANY_DOMAIN, 'niramai.com')
  assert.equal(niramai.VERIFIED_AT, '2026-07-25')
  assert.equal(niramai.CAREERS_URL, 'https://niramai.com/career/')
  assert.deepEqual(niramai.SCRAPER_METADATA, {
    source: 'niramai',
    companyName: 'Niramai',
    companyCareerPage: 'https://niramai.com/career/',
    companyDomain: 'niramai.com',
    countryFilter: 'India',
    atsPlatform: 'official-company-careers',
    paginationStrategy: 'verified-first-party-jobs-archive-page-plus-empty-page-2-check',
    extractionStrategy:
      'verified-simple-job-board-archive+inline-expanded-descriptions+detail-links-as-apply-urls',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
  })
})

test('buildScrapers and company coverage resolve Niramai from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'niramai')
  const scraper = buildScrapers().find((item) => item.name === 'niramai')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Niramai')
  assert.equal(provider.companyCareerPage, 'https://niramai.com/career/')
  assert.match(scraper.dryRunFile, /niramai[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Niramai\nNIRAMAI Health Analytix Pvt.Ltd\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Niramai', 'niramai', 'Niramai'],
      ['NIRAMAI Health Analytix Pvt.Ltd', 'niramai', 'Niramai'],
    ],
  )
})

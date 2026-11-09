import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadAarogyaAIModule = async () => {
  try {
    return await import('../../scraper/aarogyaai/script.js')
  } catch {
    return null
  }
}

test('AarogyaAI metadata requires a qualified inventory and does not advertise timeout-based zero verification', async () => {
  const aarogyaAI = await loadAarogyaAIModule()
  assert.ok(aarogyaAI, 'Expected AarogyaAI scraper module at ../../scraper/aarogyaai/script.js')

  assert.equal(aarogyaAI.SOURCE, 'aarogyaai')
  assert.equal(aarogyaAI.COMPANY, 'AarogyaAI')
  assert.equal(aarogyaAI.COMPANY_DOMAIN, 'aarogyaai.com')
  assert.equal(aarogyaAI.VERIFIED_AT, null)
  assert.deepEqual(aarogyaAI.FIRST_PARTY_ROOT_URLS, [
    'https://aarogyaai.com/',
    'https://aarogyaai.in/',
  ])
  assert.deepEqual(aarogyaAI.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://aarogyaai.com/careers',
    'https://aarogyaai.com/jobs',
    'https://aarogyaai.in/careers',
    'https://aarogyaai.in/jobs',
  ])
  assert.deepEqual(aarogyaAI.SCRAPER_METADATA, {
    source: 'aarogyaai',
    companyName: 'AarogyaAI',
    companyCareerPage: 'https://aarogyaai.com/',
    companyDomain: 'aarogyaai.com',
    countryFilter: 'India',
    atsPlatform: 'official-company-site-no-public-careers',
    paginationStrategy: 'bounded-configured-root-discovery',
    extractionStrategy:
      'configured-public-root-diagnostic-never-infer-zero-from-timeout',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
  })
})

test('buildScrapers and company coverage resolve AarogyaAI from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aarogyaai')
  const scraper = buildScrapers().find((item) => item.name === 'aarogyaai')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AarogyaAI')
  assert.equal(provider.companyCareerPage, 'https://aarogyaai.com/')
  assert.match(scraper.dryRunFile, /aarogyaai[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AarogyaAI\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AarogyaAI', 'aarogyaai', 'AarogyaAI']],
  )
})

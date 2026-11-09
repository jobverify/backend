import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/directi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/directi/catalog.js')
  } catch {
    assert.fail('Expected Directi catalog module at ../../scraper/directi/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/directi/script.js')
  } catch {
    assert.fail('Expected Directi scraper module at ../../scraper/directi/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Directi local catalog captures the verified careers-subdomain and broken Lever handoff contract', async () => {
  const { DIRECTI_CATALOG } = await loadCatalogModule()
  const directi = await loadScraperModule()
  const provider = buildCatalogReadyProvider(DIRECTI_CATALOG)

  assert.equal(provider.source, 'directi')
  assert.equal(provider.companyName, 'Directi')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.directi.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.directi.com/')
  assert.equal(provider.brokenLeverBoardUrl, 'https://jobs.lever.co/directi')
  assert.equal(provider.brokenLeverApiUrl, 'https://api.lever.co/v0/postings/directi?mode=json')
  assert.equal(provider.mainSiteCareers404Url, 'https://www.directi.com/careers')
  assert.equal(provider.companyDomain, 'directi.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-subdomain-plus-broken-lever-handoff')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-subdomain+verified-broken-lever-board+verified-broken-lever-api-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /directi[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.directi\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.directi\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.lever\.co\/directi/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.lever\.co\/v0\/postings\/directi\?mode=json/i)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Directi'), false)

  assert.equal(directi.PROVIDER_METADATA.source, provider.source)
  assert.equal(directi.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(directi.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Directi backlog row matches directly from local provider metadata without alias churn', async () => {
  const { DIRECTI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Directi\n',
    catalog: [buildCatalogReadyProvider(DIRECTI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Directi', 'directi', 'Directi']],
  )
})

test('buildScrapers and company coverage resolve Directi from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'directi')
  const scraper = buildScrapers().find((item) => item.name === 'directi')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Directi')
  assert.equal(provider.companyCareerPage, 'https://careers.directi.com/')
  assert.match(scraper.dryRunFile, /directi[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Directi\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Directi', 'directi', 'Directi']],
  )
})

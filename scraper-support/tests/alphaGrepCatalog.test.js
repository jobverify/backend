import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/alphagrep/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/alphagrep/catalog.js')
  } catch {
    assert.fail('Expected AlphaGrep catalog module at ../../scraper/alphagrep/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/alphagrep/script.js')
  } catch {
    assert.fail('Expected AlphaGrep scraper module at ../../scraper/alphagrep/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('AlphaGrep local catalog captures the verified first-party careers surface', async () => {
  const { ALPHAGREP_CATALOG } = await loadCatalogModule()
  const alphaGrep = await loadScraperModule()
  const provider = buildCatalogReadyProvider(ALPHAGREP_CATALOG)

  assert.equal(provider.source, 'alphagrep')
  assert.equal(provider.companyName, 'AlphaGrep')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.alpha-grep.com/career/')
  assert.equal(provider.companyDomain, 'alpha-grep.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-handoff+first-party-career-list+india-detail-pages+inline-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.homepageUrl, 'https://www.alpha-grep.com/')
  assert.equal(
    provider.careerOpportunityBaseUrl,
    'https://www.alpha-grep.com/career-opportunity',
  )
  assert.equal(
    provider.verifiedIndiaJobUrl,
    'https://www.alpha-grep.com/career-opportunity/?jid=6902979002',
  )
  assert.deepEqual(provider.verifiedCareers404Urls, [
    'https://www.alpha-grep.com/careers/',
    'https://www.alpha-grep.com/jobs/',
  ])
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.alpha-grep\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.alpha-grep\.com\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /career-opportunity\/\?jid=6902979002/i)
  assert.match(provider.verifiedSurfaceSummary, /five India jobs/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /alphagrep[\\/]jobs\.json$/i)

  assert.equal(alphaGrep.PROVIDER_METADATA.source, provider.source)
  assert.equal(alphaGrep.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(alphaGrep.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    alphaGrep.PROVIDER_METADATA.careerOpportunityBaseUrl,
    provider.careerOpportunityBaseUrl,
  )
})

test('AlphaGrep exact backlog name matches from the local provider contract without aliases', async () => {
  const { ALPHAGREP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'AlphaGrep\n',
    catalog: [buildCatalogReadyProvider(ALPHAGREP_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AlphaGrep', 'alphagrep', 'AlphaGrep']],
  )
})

test('buildScrapers and company coverage resolve AlphaGrep from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alphagrep')
  const scraper = buildScrapers().find((item) => item.name === 'alphagrep')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AlphaGrep')
  assert.equal(provider.companyCareerPage, 'https://www.alpha-grep.com/career/')
  assert.match(scraper.dryRunFile, /alphagrep[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AlphaGrep\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AlphaGrep', 'alphagrep', 'AlphaGrep']],
  )
})

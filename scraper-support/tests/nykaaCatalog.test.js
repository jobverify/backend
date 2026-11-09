import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/nykaa/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nykaa/catalog.js')
  } catch {
    assert.fail('Expected Nykaa catalog module at ../../scraper/nykaa/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/nykaa/script.js')
  } catch {
    assert.fail('Expected Nykaa scraper module at ../../scraper/nykaa/script.js')
  }
}

test('Nykaa local catalog captures the verified official paginated careers board', async () => {
  const { NYKAA_CATALOG } = await loadCatalogModule()
  const nykaa = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(NYKAA_CATALOG)

  assert.equal(provider.source, 'nykaa')
  assert.equal(provider.companyName, 'Nykaa')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.nykaa.com/')
  assert.equal(provider.publicBoardUrl, 'https://careers.nykaa.com/')
  assert.equal(provider.companyDomain, 'nykaa.com')
  assert.equal(provider.atsPlatform, 'skima-hosted-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-official-careers-subdomain-plus-html-pagination',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-board+html-job-cards+detail-pages+skima-structured-metadata',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedPublicOpeningCount, 0)
  assert.equal(provider.sampleJobUrl, null)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /nykaa[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, October 9, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.nykaa\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /no public job postings/i)
  assert.match(provider.verifiedSurfaceSummary, /complete public inventory is 0/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nykaa'), false)

  assert.equal(nykaa.PROVIDER_METADATA.source, NYKAA_CATALOG.source)
  assert.equal(nykaa.PROVIDER_METADATA.companyName, NYKAA_CATALOG.companyName)
  assert.equal(nykaa.PROVIDER_METADATA.publicBoardUrl, NYKAA_CATALOG.publicBoardUrl)
})

test('Nykaa exact backlog row resolves directly from local provider metadata', async () => {
  const { NYKAA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nykaa\n',
    catalog: [hydrateProviderCatalogEntry(NYKAA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nykaa', 'nykaa', 'Nykaa']],
  )
})

test('getScraperCatalog exposes Nykaa as a runnable shared provider without alias churn', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nykaa')
  const scraper = buildScrapers().find((item) => item.name === 'nykaa')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Nykaa')
  assert.equal(provider.companyCareerPage, 'https://careers.nykaa.com/')
  assert.equal(provider.companyDomain, 'nykaa.com')
  assert.equal(provider.atsPlatform, 'skima-hosted-careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nykaa'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Nykaa\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nykaa', 'nykaa', 'Nykaa']],
  )
})

test('Nykaa hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NYKAA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NYKAA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /nykaa[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /nykaa[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

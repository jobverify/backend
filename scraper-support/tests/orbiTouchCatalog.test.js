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
const modulePath = path.resolve(currentDir, '../../scraper/orbitouch/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/orbitouch/catalog.js')
  } catch {
    assert.fail('Expected OrbiTouch catalog module at ../../scraper/orbitouch/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/orbitouch/script.js')
  } catch {
    assert.fail('Expected OrbiTouch scraper module at ../../scraper/orbitouch/script.js')
  }
}

test('OrbiTouch local catalog captures the verified official jobs board and first-party detail pages', async () => {
  const { ORBITOUCH_CATALOG } = await loadCatalogModule()
  const orbitouch = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(ORBITOUCH_CATALOG)

  assert.equal(provider.source, 'orbitouch')
  assert.equal(provider.companyName, 'OrbiTouch')
  assert.equal(provider.officialBrandName, 'orbiTouch HR')
  assert.equal(provider.legalEntityName, 'OrbiTouch Outsourcing Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.orbitouch-hr.com/')
  assert.equal(provider.companyCareerPage, 'https://www.orbitouch-hr.com/jobs')
  assert.equal(provider.submitCvUrl, 'https://www.orbitouch-hr.com/careers')
  assert.equal(provider.sampleJobUrl, 'https://www.orbitouch-hr.com/jobs/recruitment-officer-')
  assert.equal(provider.companyDomain, 'orbitouch-hr.com')
  assert.equal(provider.atsPlatform, 'wix-dynamic-jobs-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-wix-jobs-list-plus-derived-dynamic-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-list+visible-list-cards+warmup-title-options+derived-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.verifiedPublicJobCount, 16)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /orbitouch[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.orbitouch-hr\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /16 public jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /recruitment-officer-/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OrbiTouch'), false)

  assert.equal(orbitouch.PROVIDER_METADATA.source, ORBITOUCH_CATALOG.source)
  assert.equal(orbitouch.PROVIDER_METADATA.companyName, ORBITOUCH_CATALOG.companyName)
  assert.equal(orbitouch.PROVIDER_METADATA.submitCvUrl, ORBITOUCH_CATALOG.submitCvUrl)
})

test('OrbiTouch exact backlog row resolves directly from local provider metadata', async () => {
  const { ORBITOUCH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'OrbiTouch\n',
    catalog: [hydrateProviderCatalogEntry(ORBITOUCH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OrbiTouch', 'orbitouch', 'OrbiTouch']],
  )
})

test('getScraperCatalog exposes OrbiTouch as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'orbitouch')
  const scraper = buildScrapers().find((item) => item.name === 'orbitouch')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'OrbiTouch')
  assert.equal(provider.companyCareerPage, 'https://www.orbitouch-hr.com/jobs')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OrbiTouch'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'OrbiTouch\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OrbiTouch', 'orbitouch', 'OrbiTouch']],
  )
})

test('OrbiTouch hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { ORBITOUCH_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ORBITOUCH_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /orbitouch[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /orbitouch[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

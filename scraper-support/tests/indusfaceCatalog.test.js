import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const indusfaceModulePath = path.resolve(currentDir, '../../scraper/indusface/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/indusface/catalog.js')
  } catch {
    assert.fail('Expected Indusface catalog module at ../../scraper/indusface/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/indusface/script.js')
  } catch {
    assert.fail('Expected Indusface scraper module at ../../scraper/indusface/script.js')
  }
}

test('Indusface local catalog captures the verified first-party current-openings page and detail-form careers surface', async () => {
  const { INDUSFACE_CATALOG } = await loadCatalogModule()
  const indusface = await loadScriptModule()

  assert.equal(INDUSFACE_CATALOG.source, 'indusface')
  assert.equal(INDUSFACE_CATALOG.companyName, 'Indusface')
  assert.equal(INDUSFACE_CATALOG.officialBrandName, 'Indusface')
  assert.equal(INDUSFACE_CATALOG.adapter, 'script')
  assert.equal(INDUSFACE_CATALOG.companyCareerPage, 'https://www.indusface.com/careers/current-openings/')
  assert.equal(INDUSFACE_CATALOG.homepageUrl, 'https://www.indusface.com/career/')
  assert.equal(
    INDUSFACE_CATALOG.sampleJobUrl,
    'https://www.indusface.com/careers/current-openings/information-security-analyst/',
  )
  assert.equal(INDUSFACE_CATALOG.companyDomain, 'indusface.com')
  assert.equal(INDUSFACE_CATALOG.atsPlatform, 'official-first-party-html-jobs-form')
  assert.equal(INDUSFACE_CATALOG.countryFilter, 'India')
  assert.equal(
    INDUSFACE_CATALOG.paginationStrategy,
    'single-first-party-current-openings-page-plus-detail-pages',
  )
  assert.equal(
    INDUSFACE_CATALOG.extractionStrategy,
    'verified-first-party-current-openings-page+html-job-cards+first-party-detail-pages+on-page-join-form',
  )
  assert.equal(INDUSFACE_CATALOG.parser, 'custom-script')
  assert.equal(INDUSFACE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INDUSFACE_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(INDUSFACE_CATALOG.dryRunFile, 'indusface/jobs.json')
  assert.equal(INDUSFACE_CATALOG.modulePath, indusfaceModulePath)
  assert.match(INDUSFACE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.indusface\.com\/career\//i)
  assert.match(
    INDUSFACE_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.indusface\.com\/careers\/current-openings\//i,
  )
  assert.match(INDUSFACE_CATALOG.verifiedSurfaceSummary, /\bfive public role cards\b/i)
  assert.match(
    INDUSFACE_CATALOG.verifiedSurfaceSummary,
    /information-security-analyst/i,
  )
  assert.match(
    INDUSFACE_CATALOG.verifiedSurfaceSummary,
    /wp-content\/themes\/indusface\/sentmail/i,
  )

  assert.equal(indusface.PROVIDER_METADATA.source, INDUSFACE_CATALOG.source)
  assert.equal(indusface.PROVIDER_METADATA.companyName, INDUSFACE_CATALOG.companyName)
  assert.equal(indusface.PROVIDER_METADATA.companyCareerPage, INDUSFACE_CATALOG.companyCareerPage)
})

test('Indusface exact backlog row resolves from local provider metadata without aliases', async () => {
  const { INDUSFACE_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Indusface\n',
    catalog: [INDUSFACE_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Indusface', 'indusface', 'Indusface']],
  )
})

test('getScraperCatalog includes Indusface as a verified first-party HTML jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indusface')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Indusface')
  assert.equal(provider.companyCareerPage, 'https://www.indusface.com/careers/current-openings/')
  assert.equal(provider.companyDomain, 'indusface.com')
  assert.equal(provider.atsPlatform, 'official-first-party-html-jobs-form')
  assert.match(provider.modulePath, /indusface[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Indusface scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'indusface')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indusface')
  assert.equal(scraper.provider.atsPlatform, 'official-first-party-html-jobs-form')
  assert.match(scraper.dryRunFile, /indusface[\\/]jobs\.json$/i)
})

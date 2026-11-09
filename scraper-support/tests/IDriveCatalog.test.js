import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const idriveModulePath = path.resolve(currentDir, '../../scraper/idrive/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/idrive/catalog.js')
  } catch {
    assert.fail('Expected IDrive catalog module at ../../scraper/idrive/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/idrive/script.js')
  } catch {
    assert.fail('Expected IDrive scraper module at ../../scraper/idrive/script.js')
  }
}

test('IDrive local catalog captures the verified first-party embedded jobs feed contract', async () => {
  const { IDRIVE_CATALOG } = await loadCatalogModule()
  const idrive = await loadScriptModule()

  assert.equal(IDRIVE_CATALOG.source, 'idrive')
  assert.equal(IDRIVE_CATALOG.companyName, 'IDrive')
  assert.equal(IDRIVE_CATALOG.officialBrandName, 'IDrive')
  assert.equal(IDRIVE_CATALOG.adapter, 'script')
  assert.equal(IDRIVE_CATALOG.companyCareerPage, 'https://www.idrive.com/jobs/')
  assert.equal(
    IDRIVE_CATALOG.officialJobsWidgetUrl,
    'https://widgets.sociablekit.com/indeed-jobs/iframe/25575419',
  )
  assert.equal(
    IDRIVE_CATALOG.jobsFeedUrl,
    'https://data.accentapi.com/feed/25575419.json',
  )
  assert.equal(
    IDRIVE_CATALOG.widgetSettingsUrl,
    'https://data.accentapi.com/settings/25575419/settings.json',
  )
  assert.equal(
    IDRIVE_CATALOG.widgetEmbedInfoUrl,
    'https://api.sociablekit.com/api/user_embed/info/25575419',
  )
  assert.equal(IDRIVE_CATALOG.widgetEmbedId, '25575419')
  assert.equal(IDRIVE_CATALOG.companyDomain, 'idrive.com')
  assert.equal(IDRIVE_CATALOG.atsPlatform, 'indeed-via-sociablekit')
  assert.equal(IDRIVE_CATALOG.countryFilter, 'India')
  assert.equal(IDRIVE_CATALOG.paginationStrategy, 'official-widget-feed-single-request')
  assert.equal(
    IDRIVE_CATALOG.extractionStrategy,
    'official-careers-page+embedded-sociablekit-indeed-feed-json',
  )
  assert.equal(IDRIVE_CATALOG.parser, 'custom-script')
  assert.equal(IDRIVE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(IDRIVE_CATALOG.dryRunFile, 'idrive/jobs.json')
  assert.equal(IDRIVE_CATALOG.verifiedOn, '2026-07-16')
  assert.match(IDRIVE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.idrive\.com\/jobs\//i)
  assert.match(IDRIVE_CATALOG.verifiedSurfaceSummary, /sociablekit/i)
  assert.match(IDRIVE_CATALOG.verifiedSurfaceSummary, /0 IDrive jobs/i)
  assert.equal(IDRIVE_CATALOG.modulePath, idriveModulePath)

  assert.equal(idrive.PROVIDER_METADATA.source, IDRIVE_CATALOG.source)
  assert.equal(idrive.PROVIDER_METADATA.companyCareerPage, IDRIVE_CATALOG.companyCareerPage)
  assert.equal(idrive.PROVIDER_METADATA.jobsFeedUrl, IDRIVE_CATALOG.jobsFeedUrl)
})

test('IDrive exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { IDRIVE_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'IDrive\n',
    catalog: [IDRIVE_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IDrive', 'idrive', 'IDrive']],
  )
})

test('getScraperCatalog includes IDrive as a verified official embedded jobs feed provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'idrive')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IDrive')
  assert.equal(provider.companyCareerPage, 'https://www.idrive.com/jobs/')
  assert.equal(provider.companyDomain, 'idrive.com')
  assert.equal(provider.atsPlatform, 'indeed-via-sociablekit')
  assert.match(provider.modulePath, /idrive[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable IDrive scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'idrive')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'idrive')
  assert.equal(scraper.provider.atsPlatform, 'indeed-via-sociablekit')
  assert.match(scraper.dryRunFile, /idrive[\\/]jobs\.json$/i)
})

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
const modulePath = path.resolve(currentDir, '../../scraper/scripbox/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/scripbox/catalog.js')
  } catch {
    assert.fail('Expected Scripbox catalog module at ../../scraper/scripbox/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/scripbox/script.js')
  } catch {
    assert.fail('Expected Scripbox scraper module at ../../scraper/scripbox/script.js')
  }
}

test('Scripbox local catalog captures the verified first-party careers page and Darwinbox handoff metadata', async () => {
  const { SCRIPBOX_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const scripbox = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SCRIPBOX_CATALOG)

  assert.equal(defaultCatalog, SCRIPBOX_CATALOG)
  assert.equal(provider.source, 'scripbox')
  assert.equal(provider.companyName, 'Scripbox')
  assert.equal(provider.officialBrandName, 'Scripbox')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://scripbox.com/')
  assert.equal(provider.companyCareerPage, 'https://scripbox.com/pages/careers')
  assert.equal(provider.publicBoardUrl, 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69e5d49b8a0ef?from=all',
  )
  assert.equal(provider.companyDomain, 'scripbox.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-embedded-next-data-darwinbox-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-embedded-next-data')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+embedded-next-data-jobopenings-array+darwinbox-detail-links+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /scripbox[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/scripbox\.com\/pages\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Job Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Development Engineer in Test/i)
  assert.match(provider.verifiedSurfaceSummary, /candidatev2\/main\/careers\/jobDetails/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Scripbox'), false)

  assert.equal(scripbox.PROVIDER_METADATA.source, SCRIPBOX_CATALOG.source)
  assert.equal(scripbox.PROVIDER_METADATA.companyName, SCRIPBOX_CATALOG.companyName)
  assert.equal(scripbox.CAREERS_URL, SCRIPBOX_CATALOG.companyCareerPage)
  assert.equal(scripbox.PUBLIC_BOARD_URL, SCRIPBOX_CATALOG.publicBoardUrl)
})

test('Scripbox exact backlog row resolves directly from local provider metadata', async () => {
  const { SCRIPBOX_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Scripbox\n',
    catalog: [hydrateProviderCatalogEntry(SCRIPBOX_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Scripbox', 'scripbox', 'Scripbox']],
  )
})

test('getScraperCatalog exposes Scripbox as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'scripbox')
  const scraper = buildScrapers().find((item) => item.name === 'scripbox')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Scripbox')
  assert.equal(provider.companyCareerPage, 'https://scripbox.com/pages/careers')
  assert.equal(provider.publicBoardUrl, 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Scripbox'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Scripbox\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Scripbox', 'scripbox', 'Scripbox']],
  )
})

test('Scripbox hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { SCRIPBOX_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SCRIPBOX_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Scripbox')
  assert.equal(provider.companyCareerPage, 'https://scripbox.com/pages/careers')
  assert.equal(provider.companyDomain, 'scripbox.com')
  assert.equal(provider.publicBoardUrl, 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.match(provider.modulePath, /scripbox[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /scripbox[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

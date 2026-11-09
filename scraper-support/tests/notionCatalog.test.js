import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/notion/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/notion/catalog.js')
  } catch {
    assert.fail('Expected Notion catalog module at ../../scraper/notion/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/notion/script.js')
  } catch {
    assert.fail('Expected Notion scraper module at ../../scraper/notion/script.js')
  }
}

test('Notion local catalog captures the verified official careers page to Ashby handoff', async () => {
  const { NOTION_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const notion = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(NOTION_CATALOG)

  assert.equal(defaultCatalog, NOTION_CATALOG)
  assert.equal(provider.source, 'notion')
  assert.equal(provider.companyName, 'Notion')
  assert.equal(provider.officialBrandName, 'Notion')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.notion.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.notion.com/careers')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/notion')
  assert.equal(provider.ashbyJobBoardUrl, 'https://api.ashbyhq.com/posting-api/job-board/notion')
  assert.equal(provider.companyDomain, 'notion.com')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-site-handoff-plus-public-ashby-job-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page-handoff+public-ashby-job-board-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /notion[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.notion\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/notion/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/notion/i)
  assert.match(provider.verifiedSurfaceSummary, /Hyderabad, India/i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Support - Billing/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer, Infrastructure/i)

  assert.equal(notion.PROVIDER_METADATA.source, NOTION_CATALOG.source)
  assert.equal(notion.PROVIDER_METADATA.companyName, NOTION_CATALOG.companyName)
  assert.equal(notion.PROVIDER_METADATA.ashbyJobBoardUrl, NOTION_CATALOG.ashbyJobBoardUrl)
})

test('Notion exact backlog row matches directly from local provider metadata', async () => {
  const { NOTION_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Notion\n',
    catalog: [hydrateProviderCatalogEntry(NOTION_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Notion', 'notion', 'Notion']],
  )
})

test('Notion hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NOTION_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NOTION_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Notion')
  assert.equal(provider.companyCareerPage, 'https://www.notion.com/careers')
  assert.equal(provider.companyDomain, 'notion.com')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.match(provider.modulePath, /notion[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /notion[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

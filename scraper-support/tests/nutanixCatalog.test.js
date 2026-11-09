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
const modulePath = path.resolve(currentDir, '../../scraper/nutanix/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nutanix/catalog.js')
  } catch {
    assert.fail('Expected Nutanix catalog module at ../../scraper/nutanix/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/nutanix/script.js')
  } catch {
    assert.fail('Expected Nutanix scraper module at ../../scraper/nutanix/script.js')
  }
}

test('Nutanix local catalog captures the verified official careers page and public Jobvite handoff', async () => {
  const { NUTANIX_CATALOG } = await loadCatalogModule()
  const nutanix = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(NUTANIX_CATALOG)

  assert.equal(provider.source, 'nutanix')
  assert.equal(provider.companyName, 'Nutanix')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.nutanix.com/en/jobs/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://jobs.jobvite.com/nutanix')
  assert.equal(provider.jobListingsPageUrl, 'https://jobs.jobvite.com/nutanix/jobs')
  assert.equal(provider.companyDomain, 'nutanix.com')
  assert.equal(provider.atsPlatform, 'jobvite')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-official-careers-page-plus-public-jobvite-current-openings-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+official-job-detail-apply-handoff+public-jobvite-current-openings+india-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /nutanix[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.nutanix\.com\/en\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.jobvite\.com\/nutanix/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.jobvite\.com\/nutanix\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nutanix'), false)

  assert.equal(nutanix.PROVIDER_METADATA.source, NUTANIX_CATALOG.source)
  assert.equal(nutanix.PROVIDER_METADATA.companyName, NUTANIX_CATALOG.companyName)
  assert.equal(
    nutanix.PROVIDER_METADATA.jobListingsPageUrl,
    NUTANIX_CATALOG.jobListingsPageUrl,
  )
})

test('Nutanix exact backlog row resolves directly from local provider metadata', async () => {
  const { NUTANIX_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nutanix\n',
    catalog: [hydrateProviderCatalogEntry(NUTANIX_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nutanix', 'nutanix', 'Nutanix']],
  )
})

test('getScraperCatalog exposes Nutanix as a runnable shared provider without alias churn', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nutanix')
  const scraper = buildScrapers().find((item) => item.name === 'nutanix')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Nutanix')
  assert.equal(provider.companyCareerPage, 'https://careers.nutanix.com/en/jobs/')
  assert.equal(provider.companyDomain, 'nutanix.com')
  assert.equal(provider.atsPlatform, 'jobvite')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nutanix'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Nutanix\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nutanix', 'nutanix', 'Nutanix']],
  )
})

test('Nutanix hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NUTANIX_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NUTANIX_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /nutanix[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /nutanix[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

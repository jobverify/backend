import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/groupon/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/groupon/catalog.js')
  } catch {
    assert.fail('Expected Groupon catalog module at ../../scraper/groupon/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/groupon/script.js')
  } catch {
    assert.fail('Expected Groupon scraper module at ../../scraper/groupon/script.js')
  }
}

test('Groupon local catalog captures the verified first-party careers handoff to the official Greenhouse board', async () => {
  const { GROUPON_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const groupon = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(GROUPON_CATALOG)

  assert.equal(defaultCatalog, GROUPON_CATALOG)
  assert.equal(provider.source, 'groupon')
  assert.equal(provider.companyName, 'Groupon')
  assert.equal(provider.officialBrandName, 'Groupon')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.grouponcareers.com/')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.grouponcareers.com/')
  assert.equal(provider.officialJobsBoardUrl, 'https://job-boards.eu.greenhouse.io/groupon')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/groupon/jobs')
  assert.equal(provider.greenhouseJobBaseUrl, 'https://job-boards.eu.greenhouse.io/groupon/jobs')
  assert.equal(provider.sampleJobUrl, 'https://job-boards.eu.greenhouse.io/groupon/jobs/4970408101')
  assert.equal(provider.companyDomain, 'grouponcareers.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+greenhouse-board-backlink+visible-greenhouse-board-jobs+greenhouse-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedJobCount, 23)
  assert.match(provider.dryRunFile, /groupon[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.grouponcareers\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.eu\.greenhouse\.io\/groupon/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/groupon\/jobs\?content=true/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b23 public jobs\b/i)
  assert.match(provider.verifiedSurfaceSummary, /four Bangalore roles/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Groupon'), false)

  assert.equal(groupon.PROVIDER_METADATA.source, GROUPON_CATALOG.source)
  assert.equal(groupon.PROVIDER_METADATA.companyName, GROUPON_CATALOG.companyName)
  assert.equal(
    groupon.PROVIDER_METADATA.greenhouseJobsApiUrl,
    GROUPON_CATALOG.greenhouseJobsApiUrl,
  )
})

test('Groupon exact backlog row matches directly from local provider metadata', async () => {
  const { GROUPON_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Groupon\n',
    catalog: [hydrateProviderCatalogEntry(GROUPON_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Groupon', 'groupon', 'Groupon']],
  )
})

test('Groupon hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { GROUPON_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GROUPON_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Groupon')
  assert.equal(provider.companyCareerPage, 'https://www.grouponcareers.com/')
  assert.equal(provider.companyDomain, 'grouponcareers.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /groupon[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /groupon[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

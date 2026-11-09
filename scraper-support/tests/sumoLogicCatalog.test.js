import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sumologic/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sumologic/catalog.js')
  } catch {
    assert.fail('Expected Sumo Logic catalog module at ../../scraper/sumologic/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sumologic/script.js')
  } catch {
    assert.fail('Expected Sumo Logic scraper module at ../../scraper/sumologic/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Sumo Logic local catalog captures the verified first-party careers page and public Greenhouse surface', async () => {
  const { SUMO_LOGIC_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sumoLogic = await loadScriptModule()
  const provider = buildCatalogReadyProvider(SUMO_LOGIC_CATALOG)

  assert.equal(defaultCatalog, SUMO_LOGIC_CATALOG)
  assert.equal(provider.source, 'sumologic')
  assert.equal(provider.companyName, 'Sumo Logic')
  assert.equal(provider.officialBrandName, 'Sumo Logic')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sumologic.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sumologic.com/company/careers')
  assert.equal(provider.careersMarkdownUrl, 'https://www.sumologic.com/company/careers.md')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/sumologic')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/sumologic/jobs',
  )
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-page-plus-greenhouse-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-careers-markdown+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sumologic.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sumologic\.com\/company\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sumologic\.com\/company\/careers\.md/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/sumologic/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/sumologic\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /Noida, Uttar Pradesh, India/i)
  assert.match(provider.verifiedSurfaceSummary, /Bengaluru, Karnataka, India/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sumologic[\\/]jobs\.json$/i)

  assert.equal(sumoLogic.PROVIDER_METADATA.source, provider.source)
  assert.equal(sumoLogic.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(sumoLogic.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Sumo Logic exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { SUMO_LOGIC_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sumo Logic\n',
    catalog: [buildCatalogReadyProvider(SUMO_LOGIC_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sumo Logic', 'sumologic', 'Sumo Logic']],
  )
})

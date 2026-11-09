import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/innovapptive/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/innovapptive/catalog.js')
  } catch {
    assert.fail('Expected Innovapptive catalog module at ../../scraper/innovapptive/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/innovapptive/script.js')
  } catch {
    assert.fail('Expected Innovapptive scraper module at ../../scraper/innovapptive/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Innovapptive local catalog captures the verified first-party careers shell and mixed-region ApplyToJob board', async () => {
  const { INNOVAPPTIVE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const innovapptive = await loadScriptModule()
  const provider = buildCatalogReadyProvider(INNOVAPPTIVE_CATALOG)

  assert.equal(defaultCatalog, INNOVAPPTIVE_CATALOG)
  assert.equal(provider.source, 'innovapptive')
  assert.equal(provider.companyName, 'Innovapptive')
  assert.equal(provider.officialBrandName, 'Innovapptive')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.innovapptive.com/')
  assert.equal(provider.companyCareerPage, 'https://www.innovapptive.com/company/careers')
  assert.equal(provider.boardUrl, 'https://innovapptive.applytojob.com/apply')
  assert.equal(provider.atsPlatform, 'official-careers-page-plus-applytojob-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'html-board')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'innovapptive.com')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /Sunday, August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /innovapptive\.applytojob\.com\/apply/i)
  assert.match(provider.verifiedSurfaceSummary, /AI Platform Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate Solution Consultant - EAM/i)
  assert.match(provider.verifiedSurfaceSummary, /Support Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /mixed-region remote roles/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /innovapptive[\\/]jobs\.json$/i)

  assert.equal(innovapptive.PROVIDER_METADATA.source, provider.source)
  assert.equal(innovapptive.PROVIDER_METADATA.boardUrl, provider.boardUrl)
})

test('Innovapptive exact backlog row resolves from the local provider contract', async () => {
  const { INNOVAPPTIVE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Innovapptive\n',
    catalog: [buildCatalogReadyProvider(INNOVAPPTIVE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Innovapptive', 'innovapptive', 'Innovapptive']],
  )
})

import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const aurobindoPharmaModulePath = path.resolve(currentDir, '../../scraper/aurobindopharma/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aurobindopharma/catalog.js')
  } catch {
    assert.fail('Expected Aurobindo Pharma catalog module at ../../scraper/aurobindopharma/catalog.js')
  }
}

const loadAurobindoPharmaModule = async () => {
  try {
    return await import('../../scraper/aurobindopharma/script.js')
  } catch {
    assert.fail('Expected Aurobindo Pharma scraper module at ../../scraper/aurobindopharma/script.js')
  }
}

test('Aurobindo Pharma local catalog captures the verified official careers page and broken TalentRecruit handoff state', async () => {
  const { AUROBINDO_PHARMA_CATALOG } = await loadCatalogModule()
  const aurobindoPharma = await loadAurobindoPharmaModule()

  assert.equal(AUROBINDO_PHARMA_CATALOG.source, 'aurobindopharma')
  assert.equal(AUROBINDO_PHARMA_CATALOG.companyName, 'Aurobindo Pharma')
  assert.equal(AUROBINDO_PHARMA_CATALOG.officialBrandName, 'Aurobindo Pharma')
  assert.equal(AUROBINDO_PHARMA_CATALOG.legalEntityName, 'Aurobindo Pharma Limited')
  assert.equal(AUROBINDO_PHARMA_CATALOG.adapter, 'script')
  assert.equal(AUROBINDO_PHARMA_CATALOG.companyCareerPage, 'https://www.aurobindo.com/careers')
  assert.equal(AUROBINDO_PHARMA_CATALOG.homepageUrl, 'https://www.aurobindo.com/')
  assert.equal(AUROBINDO_PHARMA_CATALOG.careersPageUrl, 'https://www.aurobindo.com/careers')
  assert.equal(AUROBINDO_PHARMA_CATALOG.careersHandoffUrl, 'https://aurobindo.talentrecruit.com/Search/')
  assert.equal(AUROBINDO_PHARMA_CATALOG.careersHostUrl, 'https://aurobindo.talentrecruit.com/')
  assert.equal(AUROBINDO_PHARMA_CATALOG.atsPlatform, 'official-company-careers-broken-handoff')
  assert.equal(AUROBINDO_PHARMA_CATALOG.countryFilter, 'India')
  assert.equal(
    AUROBINDO_PHARMA_CATALOG.paginationStrategy,
    'current-corporate-careers+exact-declared-native-handoff;stop-on-unavailable-inventory',
  )
  assert.equal(
    AUROBINDO_PHARMA_CATALOG.extractionStrategy,
    'current-employer-handoff-binding+native-HTTP-evidence+explicit-unverified-inventory',
  )
  assert.equal(AUROBINDO_PHARMA_CATALOG.parser, 'custom-script')
  assert.equal(AUROBINDO_PHARMA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AUROBINDO_PHARMA_CATALOG.companyDomain, 'aurobindo.com')
  assert.equal(AUROBINDO_PHARMA_CATALOG.verifiedOn, null)
  assert.match(AUROBINDO_PHARMA_CATALOG.verifiedSurfaceSummary, /exact Aurobindo TalentRecruit Search handoff/i)
  assert.match(AUROBINDO_PHARMA_CATALOG.verifiedSurfaceSummary, /unknown.inventory/i)
  assert.equal(AUROBINDO_PHARMA_CATALOG.modulePath, aurobindoPharmaModulePath)

  assert.equal(aurobindoPharma.PROVIDER_METADATA.source, AUROBINDO_PHARMA_CATALOG.source)
  assert.equal(aurobindoPharma.PROVIDER_METADATA.companyName, AUROBINDO_PHARMA_CATALOG.companyName)
  assert.equal(
    aurobindoPharma.PROVIDER_METADATA.companyCareerPage,
    AUROBINDO_PHARMA_CATALOG.companyCareerPage,
  )
  assert.equal(
    aurobindoPharma.PROVIDER_METADATA.careersHandoffUrl,
    AUROBINDO_PHARMA_CATALOG.careersHandoffUrl,
  )
})

test('Aurobindo Pharma coverage resolves the backlog company name without requiring an alias entry', async () => {
  const { AUROBINDO_PHARMA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Aurobindo Pharma\nAurobindo Pharma Limited\n',
    catalog: [AUROBINDO_PHARMA_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Aurobindo Pharma', 'aurobindopharma', 'Aurobindo Pharma'],
      ['Aurobindo Pharma Limited', 'aurobindopharma', 'Aurobindo Pharma'],
    ],
  )
})

test('buildScrapers and company coverage resolve Aurobindo Pharma from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aurobindopharma')
  const scraper = buildScrapers().find((item) => item.name === 'aurobindopharma')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aurobindo Pharma')
  assert.equal(provider.companyCareerPage, 'https://www.aurobindo.com/careers')
  assert.match(scraper.dryRunFile, /aurobindopharma[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aurobindo Pharma\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aurobindo Pharma', 'aurobindopharma', 'Aurobindo Pharma']],
  )
})

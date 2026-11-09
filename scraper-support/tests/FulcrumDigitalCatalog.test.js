import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fulcrumdigital/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fulcrumdigital/catalog.js')
  } catch {
    assert.fail('Expected Fulcrum Digital catalog module at ../../scraper/fulcrumdigital/catalog.js')
  }
}

test('Fulcrum Digital local catalog captures the verified company-branded Zoho Recruit board', async () => {
  const { FULCRUM_DIGITAL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FULCRUM_DIGITAL_CATALOG)

  assert.equal(defaultCatalog, FULCRUM_DIGITAL_CATALOG)
  assert.equal(provider.source, 'fulcrumdigital')
  assert.equal(provider.companyName, 'Fulcrum Digital')
  assert.equal(provider.companyCareerPage, 'https://fulcrumdigital.zohorecruit.com/careers')
  assert.equal(provider.jobsBoardUrl, 'https://fulcrumdigital.zohorecruit.com/jobs/Careers')
  assert.equal(provider.atsPlatform, 'zohorecruit-hidden-jobs-input')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-hidden-jobs-input')
  assert.equal(
    provider.extractionStrategy,
    'verified-company-branded-zohorecruit-board+hidden-jobs-input',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.companyDomain, 'fulcrumdigital.com')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /SOC Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /AI QA Engineer/i)
})

test('Fulcrum Digital exact backlog row resolves from the local catalog object', async () => {
  const { FULCRUM_DIGITAL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Fulcrum Digital\n',
    catalog: [hydrateProviderCatalogEntry(FULCRUM_DIGITAL_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

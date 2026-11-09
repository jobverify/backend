import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/agilisium/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/agilisium/catalog.js')
  } catch {
    assert.fail('Expected Agilisium catalog module at ../../scraper/agilisium/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/agilisium/script.js')
  } catch {
    assert.fail('Expected Agilisium scraper module at ../../scraper/agilisium/script.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Agilisium local catalog captures the verified first-party careers handoff', async () => {
  const { AGILISIUM_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const agilisium = await loadScriptModule()
  const provider = buildProvider(AGILISIUM_CATALOG)

  assert.equal(defaultCatalog, AGILISIUM_CATALOG)
  assert.equal(provider.source, 'agilisium')
  assert.equal(provider.companyName, 'Agilisium')
  assert.equal(provider.officialBrandName, 'Agilisium')
  assert.equal(provider.companyCareerPage, 'https://www.agilisium.com/people-and-careers')
  assert.equal(provider.jobsBoardUrl, 'https://agilisium.zohorecruit.com/jobs/Careers')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.match(provider.verifiedSurfaceSummary, /October 26, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /agilisium\.zohorecruit\.com\/jobs\/Careers/i)
  assert.equal(provider.modulePath, modulePath)
  assert.equal(agilisium.PROVIDER_METADATA.jobsBoardUrl, provider.jobsBoardUrl)
})

test('Agilisium exact backlog row resolves from the local provider contract', async () => {
  const { AGILISIUM_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Agilisium\n',
    catalog: [buildProvider(AGILISIUM_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

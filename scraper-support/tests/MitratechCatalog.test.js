import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mitratech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mitratech/catalog.js')
  } catch {
    assert.fail('Expected Mitratech catalog module at ../../scraper/mitratech/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Mitratech local catalog captures the verified Greenhouse careers handoff', async () => {
  const { MITRATECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(MITRATECH_CATALOG)

  assert.equal(defaultCatalog, MITRATECH_CATALOG)
  assert.equal(provider.source, 'mitratech')
  assert.equal(provider.companyName, 'Mitratech')
  assert.equal(provider.companyCareerPage, 'https://mitratech.com/about-us/careers/')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/mitratech')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/mitratech/jobs')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Greenhouse/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Mitratech exact backlog row resolves from the local provider contract', async () => {
  const { MITRATECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Mitratech\n',
    catalog: [buildProvider(MITRATECH_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

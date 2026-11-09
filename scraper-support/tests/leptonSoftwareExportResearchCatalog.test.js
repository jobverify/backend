import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/leptonsoftwareexportresearch/script.js')

test('Lepton Software Export & Research local catalog captures the verified Keka jobs API', async () => {
  const { LEPTON_SOFTWARE_EXPORT_RESEARCH_CATALOG, default: defaultCatalog } = await import('../../scraper/leptonsoftwareexportresearch/catalog.js')
  const provider = hydrateProviderCatalogEntry(LEPTON_SOFTWARE_EXPORT_RESEARCH_CATALOG)

  assert.equal(defaultCatalog, LEPTON_SOFTWARE_EXPORT_RESEARCH_CATALOG)
  assert.equal(provider.source, 'leptonsoftwareexportresearch')
  assert.equal(provider.companyName, 'Lepton Software Export & Research')
  assert.equal(provider.jobsApiUrl, 'https://leptonsoftware.keka.com/careers/api/jobs/default/active')
  assert.equal(provider.atsPlatform, 'keka-public-jobs-api')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /Account Executive - New Business/i)
  assert.match(provider.verifiedSurfaceSummary, /QA Engineer \(QA 2\)/i)
})

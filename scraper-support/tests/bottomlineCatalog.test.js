import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bottomline/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bottomline/catalog.js')
  } catch {
    assert.fail('Expected Bottomline catalog module at ../../scraper/bottomline/catalog.js')
  }
}

test('Bottomline local catalog captures the verified first-party inline jobList surface', async () => {
  const { default: catalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(catalog)

  assert.equal(provider.source, 'bottomline')
  assert.equal(provider.companyName, 'Bottomline')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.bottomline.com/about/careers/jobs')
  assert.equal(provider.companyDomain, 'bottomline.com')
  assert.equal(provider.atsPlatform, 'greenhouse-inline-json')
  assert.equal(provider.paginationStrategy, 'single-page-inline-json')
  assert.equal(provider.extractionStrategy, 'verified-first-party-page-plus-inline-joblist-india-filter')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Accounting Operations Data Engineer/i)
})

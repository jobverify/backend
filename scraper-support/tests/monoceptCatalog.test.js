import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/monocept/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/monocept/catalog.js')
  } catch {
    assert.fail('Expected Monocept catalog module at ../../scraper/monocept/catalog.js')
  }
}

test('Monocept local catalog captures the current first-party handoff and full public native inventory', async () => {
  const { default: catalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(catalog)

  assert.equal(provider.source, 'monocept')
  assert.equal(provider.companyName, 'Monocept')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.monocept.com/careers')
  assert.equal(provider.companyDomain, 'monocept.com')
  assert.equal(provider.atsPlatform, 'turbohire')
  assert.equal(provider.paginationStrategy, 'native-total-and-unique-identities+all-public-details+closing-snapshots-before-cap')
  assert.equal(provider.extractionStrategy, 'visible-first-party-handoff+reviewed-public-client+full-public-job-dto+matching-jobposting')
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /seven public native roles/i)
  assert.match(provider.verifiedSurfaceSummary, /Build the Future of Insurance/i)
  assert.match(provider.verifiedSurfaceSummary, /TurboHire/i)
})

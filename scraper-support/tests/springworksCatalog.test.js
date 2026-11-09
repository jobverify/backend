import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/springworks/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/springworks/catalog.js')
  } catch {
    assert.fail('Expected Springworks catalog module at ../../scraper/springworks/catalog.js')
  }
}

test('Springworks local catalog captures the verified first-party Goodfit handoff', async () => {
  const { default: catalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(catalog)

  assert.equal(provider.source, 'springworks')
  assert.equal(provider.companyName, 'Springworks')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.springworks.in/about-us/')
  assert.equal(provider.companyDomain, 'springworks.in')
  assert.equal(provider.atsPlatform, 'goodfit-hosted-jobs')
  assert.equal(provider.paginationStrategy, 'single-ssr-jobs-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-handoff-plus-goodfit-react-flight-card-parse')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(provider.jobsUrl, 'https://jobs.goodfit.so/jobs/springworks')
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Success Associate/i)
})

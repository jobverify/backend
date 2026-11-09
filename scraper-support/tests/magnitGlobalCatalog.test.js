import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry, getScraperCatalog, buildScrapers } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/magnitglobal/script.js')

test('Magnit Global local catalog captures the verified first-party Dayforce handoff', async () => {
  const { MAGNIT_GLOBAL_CATALOG, default: defaultCatalog } = await import('../../scraper/magnitglobal/catalog.js')
  const provider = hydrateProviderCatalogEntry(MAGNIT_GLOBAL_CATALOG)

  assert.equal(defaultCatalog, MAGNIT_GLOBAL_CATALOG)
  assert.equal(provider.source, 'magnitglobal')
  assert.equal(provider.companyName, 'Magnit Global')
  assert.equal(provider.companyCareerPage, 'https://magnitglobal.com/about/careers')
  assert.equal(provider.dayforceBaseUrl, 'https://jobs.dayforcehcm.com/prounlimited/CANDIDATEPORTAL')
  assert.equal(provider.atsPlatform, 'dayforce+directsource')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'all-advertised-dayforce-locales+unfiltered-offsets+directsource+closing-reconciliation',
  )
  assert.equal(provider.modulePath, modulePath)
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.match(provider.verifiedSurfaceSummary, /about\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /nested.*content/i)
  assert.equal(provider.dayforceClientId, 80745)
  assert.equal(provider.directSourceBaseUrl, 'https://directsource.magnitglobal.com/eu/magnitglobal')
  assert.equal(provider.verifiedPublicPostingCount, null)
  assert.equal(provider.verifiedIndiaRoleCount, null)
})

test('Magnit merged registration exposes both current native systems and requires evidence for zero results', () => {
  const provider = getScraperCatalog().find(p => p.source === 'magnitglobal')
  assert.equal(provider.atsPlatform, 'dayforce+directsource')
  assert.equal(provider.dayforceClientId, 80745)
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.equal(provider.verifiedPublicPostingCount, null)
  assert.equal(provider.verifiedIndiaRoleCount, null)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.modulePath, modulePath)
  const scraper = buildScrapers().find(p => p.name === 'magnitglobal')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.atsPlatform, 'dayforce+directsource')
})

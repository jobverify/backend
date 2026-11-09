import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/teradata/script.js')

test('Teradata local catalog captures the verified Gr8People GraphQL jobs surface', async () => {
  const { TERADATA_CATALOG, default: defaultCatalog } = await import('../../scraper/teradata/catalog.js')
  const provider = hydrateProviderCatalogEntry(TERADATA_CATALOG)

  assert.equal(defaultCatalog, TERADATA_CATALOG)
  assert.equal(provider.source, 'teradata')
  assert.equal(provider.companyName, 'Teradata')
  assert.equal(provider.jobsApiUrl, 'https://careers.teradata.com/graphql')
  assert.equal(provider.atsPlatform, 'gr8people-graphql')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(provider.verifiedOn, '2026-11-05')
  assert.equal(provider.verifiedPublicJobCount, 181)
  assert.equal(provider.verifiedIndiaJobCount, 86)
  assert.match(provider.verifiedSurfaceSummary, /full native criteria/i)
  assert.match(provider.verifiedSurfaceSummary, /scope and lifecycle cleanup remain unqualified/i)
})

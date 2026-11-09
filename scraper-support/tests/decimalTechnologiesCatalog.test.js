import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/decimaltechnologies/script.js')

test('Decimal Technologies local catalog captures the verified fail-closed no-public-careers state', async () => {
  const { DECIMAL_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await import('../../scraper/decimaltechnologies/catalog.js')
  const provider = hydrateProviderCatalogEntry(DECIMAL_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, DECIMAL_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'decimaltechnologies')
  assert.equal(provider.companyName, 'Decimal Technologies')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.robotsTxtUrl, 'https://decimaltech.com/robots.txt')
  assert.equal(provider.sitemapUrl, 'https://decimaltech.com/sitemap.xml')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /common exact-name careers routes/i)
})

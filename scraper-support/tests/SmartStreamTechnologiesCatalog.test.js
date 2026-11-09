import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/smartstreamtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/smartstreamtechnologies/catalog.js')
  } catch {
    assert.fail('Expected SmartStream Technologies catalog module at ../../scraper/smartstreamtechnologies/catalog.js')
  }
}

const assertCatalogMatchesBacklogRow = ({ provider, companyName }) => {
  const report = generateCompanyCoverageReport({
    csvText: `${companyName}\n`,
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
}

const assertHydratedCatalogLoadsScript = async (provider) => {
  const module = await import(pathToFileURL(provider.modulePath).href)
  assert.equal(typeof module.run, 'function')
}

test('SmartStream Technologies catalog captures the verified blocked first-party Smartstream routes', async () => {
  const { SMARTSTREAM_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SMARTSTREAM_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, SMARTSTREAM_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'smartstreamtechnologies')
  assert.equal(provider.companyName, 'SmartStream Technologies')
  assert.equal(provider.officialBrandName, 'Smartstream')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://smart.stream/')
  assert.equal(provider.companyCareerPage, 'https://smart.stream/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-cloudflare-blocked-no-public-jobs-catalog')
  assert.equal(provider.paginationStrategy, 'verified-cloudflare-blocked-homepage-and-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-cloudflare-blocked-homepage+verified-cloudflare-blocked-careers-route-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.companyDomain, 'smart.stream')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare-backed HTTP 403 Forbidden/i)
  assert.match(provider.verifiedSurfaceSummary, /Error 403 Forbidden/i)
  assert.match(provider.verifiedSurfaceSummary, /no enumerable public Smartstream jobs feed/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'SmartStream Technologies',
  })
  await assertHydratedCatalogLoadsScript(provider)
})

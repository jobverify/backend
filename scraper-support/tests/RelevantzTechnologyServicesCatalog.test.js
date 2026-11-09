import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/relevantztechnologyservices/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/relevantztechnologyservices/catalog.js')
  } catch {
    assert.fail('Expected Relevantz Technology Services catalog module at ../../scraper/relevantztechnologyservices/catalog.js')
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

test('Relevantz Technology Services catalog captures the live careers app shell and WordPress JSON payload contract', async () => {
  const { RELEVANTZ_TECHNOLOGY_SERVICES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RELEVANTZ_TECHNOLOGY_SERVICES_CATALOG)

  assert.equal(defaultCatalog, RELEVANTZ_TECHNOLOGY_SERVICES_CATALOG)
  assert.equal(provider.source, 'relevantztechnologyservices')
  assert.equal(provider.companyName, 'Relevantz Technology Services')
  assert.equal(provider.officialBrandName, 'Relevantz')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.relevantz.com/')
  assert.equal(provider.companyCareerPage, 'https://www.relevantz.com/careers/')
  assert.equal(provider.wordpressOrigin, 'https://rzwp.relevantz.com')
  assert.equal(provider.wordpressCareersPageSlug, 'careers')
  assert.equal(
    provider.wordpressCareersPageApiUrl,
    'https://rzwp.relevantz.com/wp-json/wp/v2/pages?slug=careers&acf_format=standard&_fields=id,slug,title,acf',
  )
  assert.equal(provider.atsPlatform, 'official-company-careers+wordpress-json-api')
  assert.equal(provider.paginationStrategy, 'single-wordpress-page-acf-payload')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-app-shell+verified-wordpress-page-acf+india-tab-job-listings',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.companyDomain, 'relevantz.com')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.relevantz\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/rzwp\.relevantz\.com\/wp-json\/wp\/v2\/pages\?slug=careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Java Full stack Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Analyst/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Relevantz Technology Services',
  })
  await assertHydratedCatalogLoadsScript(provider)
})

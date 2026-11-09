import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/virinchitechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/virinchitechnologies/catalog.js')
  } catch {
    assert.fail('Expected Virinchi Technologies catalog module at ../../scraper/virinchitechnologies/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Virinchi Technologies local catalog captures the verified profile-signup-only careers contract', async () => {
  const { VIRINCHI_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(VIRINCHI_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, VIRINCHI_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'virinchitechnologies')
  assert.equal(provider.companyName, 'Virinchi Technologies')
  assert.equal(provider.officialBrandName, 'Virinchi')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.virinchi.com/')
  assert.equal(provider.companyCareerPage, 'https://www.virinchi.com/careers.php')
  assert.equal(provider.profileSignupUrl, 'http://www.virinchigroup.com/ksoft/profSignup.php')
  assert.equal(provider.resumeEmail, 'virinchi2015@gmail.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-profile-signup-only')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+profile-signup-link+resume-email-no-public-role-list',
  )
  assert.equal(provider.companyDomain, 'virinchi.com')
  assert.equal(provider.verifiedOn, '2026-08-06')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 6, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /\.:: Welcome to Virinchi ::\./i)
})

test('Virinchi Technologies exact backlog row resolves from the local catalog without aliases', async () => {
  const { VIRINCHI_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Virinchi Technologies\n',
    catalog: [buildProvider(VIRINCHI_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

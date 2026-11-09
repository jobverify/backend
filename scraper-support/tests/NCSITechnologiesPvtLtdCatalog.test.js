import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ncsitechnologiespvtltd/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ncsitechnologiespvtltd/catalog.js')
  } catch {
    assert.fail('Expected NCSI Technologies Pvt Ltd catalog module at ../../scraper/ncsitechnologiespvtltd/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('NCSI Technologies Pvt Ltd local catalog captures the fail-closed generic NCSi careers landing contract', async () => {
  const { NCSI_TECHNOLOGIES_PVT_LTD_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(NCSI_TECHNOLOGIES_PVT_LTD_CATALOG)

  assert.equal(defaultCatalog, NCSI_TECHNOLOGIES_PVT_LTD_CATALOG)
  assert.equal(provider.source, 'ncsitechnologiespvtltd')
  assert.equal(provider.companyName, 'NCSI Technologies Pvt Ltd')
  assert.equal(provider.officialBrandName, 'NCSi')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.ncsi.us/')
  assert.equal(provider.companyCareerPage, 'https://www.ncsi.us/careers/')
  assert.equal(provider.atsPlatform, 'first-party-generic-careers-landing-no-trustworthy-exact-name-jobs-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(provider.extractionStrategy, 'verified-generic-careers-landing-without-exact-name-india-jobs-return-empty')
  assert.equal(provider.companyDomain, 'ncsi.us')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
})

test('NCSI Technologies Pvt Ltd exact backlog row resolves from the local provider contract', async () => {
  const { NCSI_TECHNOLOGIES_PVT_LTD_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'NCSI Technologies Pvt Ltd\n',
    catalog: [buildProvider(NCSI_TECHNOLOGIES_PVT_LTD_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/22ndcenturytechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/22ndcenturytechnologies/catalog.js')
  } catch {
    assert.fail('Expected 22nd Century Technologies catalog module at ../../scraper/22ndcenturytechnologies/catalog.js')
  }
}

test('22nd Century Technologies local catalog describes the first-party staffing intake without vacancy verification', async () => {
  const { TWENTY_SECOND_CENTURY_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TWENTY_SECOND_CENTURY_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, TWENTY_SECOND_CENTURY_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, '22ndcenturytechnologies')
  assert.equal(provider.companyName, '22nd Century Technologies')
  assert.equal(provider.officialBrandName, '22nd Century Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tscti.com/career/state_il')
  assert.equal(provider.companyDomain, 'tscti.com')
  assert.equal(provider.atsPlatform, 'jobdiva-published-rss-and-staffing-intake')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'company-declared-portal+bounded-rss-keyword-feed+scope-unverified')
  assert.equal(
    provider.extractionStrategy,
    'first-party-contract-intake-observations+current-openings-handoff+jobdiva-static-script-rss+india-keyword+first-failure-stop',
  )
  assert.equal(provider.verifiedOn, '2026-11-07')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /November 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /70 region\/category/i)
  assert.match(provider.verifiedSurfaceSummary, /not verified individual vacancies/i)
})

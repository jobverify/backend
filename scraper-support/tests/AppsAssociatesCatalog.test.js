import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/appsassociates/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/appsassociates/catalog.js')
  } catch {
    assert.fail('Expected Apps Associates catalog module at ../../scraper/appsassociates/catalog.js')
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

test('Apps Associates catalog captures the verified first-party careers page plus Oracle candidate experience jobs surface', async () => {
  const { APPS_ASSOCIATES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(APPS_ASSOCIATES_CATALOG)

  assert.equal(defaultCatalog, APPS_ASSOCIATES_CATALOG)
  assert.equal(provider.source, 'appsassociates')
  assert.equal(provider.companyName, 'Apps Associates')
  assert.equal(provider.officialBrandName, 'Apps Associates')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://appsassociates.com/')
  assert.equal(provider.officialCareersPageUrl, 'https://appsassociates.com/careers/')
  assert.equal(provider.companyCareerPage, 'https://appsassociates.com/jobs/')
  assert.equal(provider.oracleCandidateExperienceUrl, 'https://appsassociates.com/jobs/')
  assert.equal(provider.atsPlatform, 'oracle-candidate-experience')
  assert.equal(provider.paginationStrategy, 'oracle-candidate-experience-india-search')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-oracle-candidate-experience-shell+oracle-listing-api+oracle-detail-api',
  )
  assert.equal(provider.verifiedOn, '2026-07-26')
  assert.equal(provider.companyDomain, 'appsassociates.com')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Oracle Candidate Experience shell/i)
  assert.match(provider.verifiedSurfaceSummary, /CX_9003/i)
  assert.match(provider.verifiedSurfaceSummary, /29 India roles/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Apps Associates',
  })
  await assertHydratedCatalogLoadsScript(provider)
})

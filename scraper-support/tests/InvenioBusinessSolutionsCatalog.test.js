import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/inveniobusinesssolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/inveniobusinesssolutions/catalog.js')
  } catch {
    assert.fail('Expected Invenio Business Solutions catalog module at ../../scraper/inveniobusinesssolutions/catalog.js')
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

test('Invenio Business Solutions catalog captures the verified first-party careers FAQ and current Jobvite zero-openings state', async () => {
  const { INVENIO_BUSINESS_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(INVENIO_BUSINESS_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, INVENIO_BUSINESS_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'inveniobusinesssolutions')
  assert.equal(provider.companyName, 'Invenio Business Solutions')
  assert.equal(provider.officialBrandName, 'Invenio')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://invenio-solutions.com/')
  assert.equal(provider.companyCareerPage, 'https://invenio-solutions.com/careers')
  assert.equal(provider.officialJobsBoardUrl, 'https://jobs.jobvite.com/inveniolsi/jobs')
  assert.equal(provider.atsPlatform, 'jobvite-zero-openings')
  assert.equal(provider.paginationStrategy, 'first-party-faq-plus-jobvite-zero-openings')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-faq+verified-jobvite-zero-openings+return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.companyDomain, 'invenio-solutions.com')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /jobs\.jobvite\.com\/inveniolsi/i)
  assert.match(provider.verifiedSurfaceSummary, /There are currently no open jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /talent\.hr@invenio-solutions\.com/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Invenio Business Solutions',
  })
  await assertHydratedCatalogLoadsScript(provider)
})

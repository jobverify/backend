import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/lloydstechnologycentre/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lloydstechnologycentre/catalog.js')
  } catch {
    assert.fail('Expected Lloyds Technology Centre catalog module at ../../scraper/lloydstechnologycentre/catalog.js')
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

test('Lloyds Technology Centre catalog captures the verified exact-name careers handoff and Workday jobs API', async () => {
  const { LLOYDS_TECHNOLOGY_CENTRE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(LLOYDS_TECHNOLOGY_CENTRE_CATALOG)

  assert.equal(defaultCatalog, LLOYDS_TECHNOLOGY_CENTRE_CATALOG)
  assert.equal(provider.source, 'lloydstechnologycentre')
  assert.equal(provider.companyName, 'Lloyds Technology Centre')
  assert.equal(provider.officialBrandName, 'Lloyds Technology Centre')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://lloydstechnologycentre.com/')
  assert.equal(provider.companyCareerPage, 'https://lloydstechnologycentre.com/')
  assert.equal(provider.officialWorkdayBoardUrl, 'https://lbg.wd3.myworkdayjobs.com/Lloyds_Technology_Centre')
  assert.equal(provider.jobsApiUrl, 'https://lbg.wd3.myworkdayjobs.com/wday/cxs/lbg/Lloyds_Technology_Centre/jobs')
  assert.equal(provider.atsPlatform, 'official-careers-handoff-workday')
  assert.equal(provider.paginationStrategy, 'Workday jobs API offset pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-workday-handoff+verified-workday-shell+paginated-workday-jobs-api',
  )
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.companyDomain, 'lloydstechnologycentre.com')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Search and apply/i)
  assert.match(provider.verifiedSurfaceSummary, /recovered Workday shell/i)
  assert.match(provider.verifiedSurfaceSummary, /paginated jobs API/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Lloyds Technology Centre',
  })
  await assertHydratedCatalogLoadsScript(provider)
})

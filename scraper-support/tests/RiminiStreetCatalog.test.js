import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/riministreet.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/riministreet.workday/catalog.js')
  } catch {
    assert.fail('Expected Rimini Street catalog module at ../../scraper/riministreet.workday/catalog.js')
  }
}

test('Rimini Street local catalog captures the verified first-party careers handoff to the public Workday board', async () => {
  const { RIMINI_STREET_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RIMINI_STREET_CATALOG)

  assert.equal(defaultCatalog, RIMINI_STREET_CATALOG)
  assert.equal(provider.source, 'riministreet')
  assert.equal(provider.companyName, 'Rimini Street')
  assert.equal(provider.officialBrandName, 'Rimini Street')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.riministreet.com/company/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.riministreet.com/company/careers/')
  assert.equal(
    provider.officialWorkdayBoardUrl,
    'https://riministreet.wd1.myworkdayjobs.com/RiminiStreet',
  )
  assert.equal(provider.companyDomain, 'riministreet.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-handoff-plus-workday-india-filter')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-workday-handoff+shared-workday-runner',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /riministreet.workday[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /See open positions/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /riministreet\.wd1\.myworkdayjobs\.com\/RiminiStreet/i)
  assert.match(provider.verifiedSurfaceSummary, /DevOps Engineer/i)
})

test('Rimini Street exact backlog row matches directly from local provider metadata', async () => {
  const { RIMINI_STREET_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rimini Street\n',
    catalog: [hydrateProviderCatalogEntry(RIMINI_STREET_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rimini Street', 'riministreet', 'Rimini Street']],
  )
})

test('Rimini Street hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { RIMINI_STREET_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RIMINI_STREET_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rimini Street')
  assert.equal(provider.companyDomain, 'riministreet.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.match(provider.modulePath, /riministreet\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /riministreet.workday[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

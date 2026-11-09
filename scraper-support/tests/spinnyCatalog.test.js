import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/spinny/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/spinny/catalog.js')
  } catch {
    assert.fail('Expected Spinny catalog module at ../../scraper/spinny/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/spinny/script.js')
  } catch {
    assert.fail('Expected Spinny scraper module at ../../scraper/spinny/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Spinny local catalog captures the verified first-party careers handoff to Darwinbox', async () => {
  const { SPINNY_CATALOG } = await loadCatalogModule()
  const spinny = await loadScriptModule()
  const provider = buildCatalogReadyProvider(SPINNY_CATALOG)

  assert.equal(provider.source, 'spinny')
  assert.equal(provider.companyName, 'Spinny')
  assert.equal(provider.officialBrandName, 'Spinny')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.spinny.com/careers/')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://spinzone.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxOrigin, 'https://spinzone.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'official-careers-page+darwinbox-listing-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'spinny.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.spinny\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/spinzone\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /spinny[\\/]jobs\.json$/i)

  assert.equal(spinny.PROVIDER_METADATA.source, provider.source)
  assert.equal(spinny.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(spinny.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Spinny exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { SPINNY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Spinny\n',
    catalog: [buildCatalogReadyProvider(SPINNY_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Spinny', 'spinny', 'Spinny']],
  )
})

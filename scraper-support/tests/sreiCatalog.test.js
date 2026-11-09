import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/srei/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/srei/catalog.js')
  } catch {
    assert.fail('Expected SREI catalog module at ../../scraper/srei/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/srei/script.js')
  } catch {
    assert.fail('Expected SREI scraper module at ../../scraper/srei/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('SREI local catalog captures the verified first-party careers page and unresolved EmployWise handoff', async () => {
  const { SREI_CATALOG } = await loadCatalogModule()
  const srei = await loadScriptModule()
  const provider = buildCatalogReadyProvider(SREI_CATALOG)

  assert.equal(provider.source, 'srei')
  assert.equal(provider.companyName, 'SREI')
  assert.equal(provider.officialBrandName, 'SREI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.srei.com/careers')
  assert.equal(
    provider.jobListingsUrl,
    'https://www.myemploywise.com/asperm/servlet/website?customer_code=srei',
  )
  assert.equal(provider.portalOrigin, 'https://www.myemploywise.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-plus-unresolved-employwise-shell',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-unresolved-employwise-shell-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'srei.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.srei\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.myemploywise\.com\/asperm\/servlet\/website\?customer_code=srei/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /srei[\\/]jobs\.json$/i)

  assert.equal(srei.PROVIDER_METADATA.source, provider.source)
  assert.equal(srei.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(srei.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('SREI exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { SREI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SREI\n',
    catalog: [buildCatalogReadyProvider(SREI_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SREI', 'srei', 'SREI']],
  )
})

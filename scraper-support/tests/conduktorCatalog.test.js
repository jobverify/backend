import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const conduktorModulePath = path.resolve(currentDir, '../../scraper/conduktor/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/conduktor/catalog.js')
  } catch {
    assert.fail('Expected Conduktor catalog module at ../../scraper/conduktor/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/conduktor/script.js')
  } catch {
    assert.fail('Expected Conduktor scraper module at ../../scraper/conduktor/script.js')
  }
}

test('Conduktor local catalog captures the verified exact-name first-party no-open-roles surface', async () => {
  const { CONDUKTOR_CATALOG } = await loadCatalogModule()
  const conduktor = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(CONDUKTOR_CATALOG)

  assert.equal(provider.source, 'conduktor')
  assert.equal(provider.companyName, 'Conduktor')
  assert.equal(provider.officialBrandName, 'Conduktor')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.conduktor.io/')
  assert.equal(provider.companyCareerPage, 'https://www.conduktor.io/careers')
  assert.equal(provider.openRolesPageUrl, 'https://www.conduktor.io/careers/open-roles')
  assert.equal(provider.companyDomain, 'conduktor.io')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-shell')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-plus-open-roles-empty-state',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-open-roles-empty-state-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.dryRunFile, /conduktor[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, conduktorModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.conduktor\.io\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.conduktor\.io\/careers\/open-roles/i)
  assert.match(provider.verifiedSurfaceSummary, /No Open Roles Right Now/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Conduktor'), false)

  assert.equal(conduktor.PROVIDER_METADATA.source, CONDUKTOR_CATALOG.source)
  assert.equal(conduktor.PROVIDER_METADATA.companyName, CONDUKTOR_CATALOG.companyName)
  assert.equal(
    conduktor.PROVIDER_METADATA.companyCareerPage,
    CONDUKTOR_CATALOG.companyCareerPage,
  )
})

test('Conduktor backlog row matches directly from the local catalog without alias churn', async () => {
  const { CONDUKTOR_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Conduktor\n',
    catalog: [hydrateProviderCatalogEntry(CONDUKTOR_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Conduktor', 'conduktor', 'Conduktor']],
  )
})

test('Conduktor is runnable through the shared scraper catalog and resolves in company coverage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'conduktor')
  const scraper = buildScrapers().find((item) => item.name === 'conduktor')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Conduktor')
  assert.equal(provider.companyCareerPage, 'https://www.conduktor.io/careers')
  assert.equal(provider.openRolesPageUrl, 'https://www.conduktor.io/careers/open-roles')
  assert.match(scraper.dryRunFile, /conduktor[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Conduktor\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Conduktor', 'conduktor', 'Conduktor']],
  )
})

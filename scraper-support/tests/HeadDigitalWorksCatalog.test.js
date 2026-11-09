import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/headdigitalworks/catalog.js')
  } catch {
    assert.fail('Expected Head Digital Works catalog module at ../../scraper/headdigitalworks/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/headdigitalworks/script.js')
  } catch {
    assert.fail('Expected Head Digital Works scraper module at ../../scraper/headdigitalworks/script.js')
  }
}

test('Head Digital Works local catalog captures the verified no-public-jobs sentinel contract', async () => {
  const { HEAD_DIGITAL_WORKS_CATALOG } = await loadCatalogModule()
  const headDigitalWorks = await loadScriptModule()

  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.source, 'headdigitalworks')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.companyName, 'Head Digital Works')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.officialBrandName, 'Head Digital Works')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.adapter, 'script')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.companyCareerPage, 'https://hdworks.in/join-our-team/')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.companyDomain, 'hdworks.in')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.countryFilter, 'India')
  assert.equal(
    HEAD_DIGITAL_WORKS_CATALOG.paginationStrategy,
    'verified-careers-page-plus-stale-external-handoff-validation',
  )
  assert.equal(
    HEAD_DIGITAL_WORKS_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-stale-openings-copy+missing-lever-handoff-return-empty',
  )
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.parser, 'custom-script')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.modulePath, '../../scraper/headdigitalworks/script.js')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(HEAD_DIGITAL_WORKS_CATALOG.dryRunFile, 'headdigitalworks/jobs.json')
  assert.match(HEAD_DIGITAL_WORKS_CATALOG.verifiedSurfaceSummary, /hdworks\.in\/join-our-team/i)
  assert.match(HEAD_DIGITAL_WORKS_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(headDigitalWorks.PROVIDER_METADATA.source, HEAD_DIGITAL_WORKS_CATALOG.source)
  assert.equal(headDigitalWorks.CAREERS_URL, HEAD_DIGITAL_WORKS_CATALOG.companyCareerPage)
})

test('Head Digital Works exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { HEAD_DIGITAL_WORKS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Head Digital Works\n',
    catalog: [HEAD_DIGITAL_WORKS_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Head Digital Works', 'headdigitalworks', 'Head Digital Works']],
  )
})

test('getScraperCatalog includes Head Digital Works as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'headdigitalworks')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Head Digital Works')
  assert.equal(provider.companyCareerPage, 'https://hdworks.in/join-our-team/')
  assert.equal(provider.companyDomain, 'hdworks.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /headdigitalworks[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Head Digital Works scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'headdigitalworks')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'headdigitalworks')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /headdigitalworks[\\/]jobs\.json$/i)
})

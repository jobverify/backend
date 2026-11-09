import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/gentari/catalog.js')
  } catch {
    assert.fail('Expected Gentari catalog module at ../../scraper/gentari/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/gentari/script.js')
  } catch {
    assert.fail('Expected Gentari scraper module at ../../scraper/gentari/script.js')
  }
}

test('Gentari local catalog captures the verified LinkedIn-handoff no-first-party-jobs contract', async () => {
  const { GENTARI_CATALOG } = await loadCatalogModule()
  const gentari = await loadScriptModule()

  assert.equal(GENTARI_CATALOG.source, 'gentari')
  assert.equal(GENTARI_CATALOG.companyName, 'Gentari')
  assert.equal(GENTARI_CATALOG.adapter, 'script')
  assert.equal(GENTARI_CATALOG.homepageUrl, 'https://www.gentari.com/')
  assert.equal(GENTARI_CATALOG.companyCareerPage, 'https://www.gentari.com/careers')
  assert.equal(GENTARI_CATALOG.indiaHomepageUrl, 'https://www.gentari.in/')
  assert.equal(GENTARI_CATALOG.indiaCareersUrl, 'https://www.gentari.in/careers')
  assert.equal(GENTARI_CATALOG.linkedinJobsUrl, 'https://www.linkedin.com/company/gentari/jobs/')
  assert.equal(GENTARI_CATALOG.companyDomain, 'gentari.com')
  assert.equal(GENTARI_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(GENTARI_CATALOG.countryFilter, 'India')
  assert.equal(
    GENTARI_CATALOG.paginationStrategy,
    'verified-global-homepage-plus-careers-linkedin-handoff-plus-india-404-careers-route',
  )
  assert.equal(
    GENTARI_CATALOG.extractionStrategy,
    'verified-global-and-india-homepages+linkedin-jobs-handoff+verified-india-404-return-empty',
  )
  assert.equal(GENTARI_CATALOG.parser, 'custom-script')
  assert.equal(GENTARI_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GENTARI_CATALOG.verifiedOn, '2026-07-16')
  assert.match(GENTARI_CATALOG.verifiedSurfaceSummary, /linkedin\.com\/company\/gentari\/jobs/i)

  assert.equal(gentari.SOURCE, GENTARI_CATALOG.source)
  assert.equal(gentari.COMPANY, GENTARI_CATALOG.companyName)
  assert.equal(gentari.HOMEPAGE_URL, GENTARI_CATALOG.homepageUrl)
  assert.equal(gentari.CAREERS_URL, GENTARI_CATALOG.companyCareerPage)
})

test('Gentari exact backlog row resolves directly from the local provider metadata without aliases', async () => {
  const { GENTARI_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Gentari\n',
    catalog: [GENTARI_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Gentari', 'gentari', 'Gentari']],
  )
})

test('getScraperCatalog includes Gentari as a verified LinkedIn-handoff sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gentari')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Gentari')
  assert.equal(provider.companyCareerPage, 'https://www.gentari.com/careers')
  assert.equal(provider.companyDomain, 'gentari.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /gentari[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Gentari scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gentari')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gentari')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /gentari[\\/]jobs\.json$/i)
})

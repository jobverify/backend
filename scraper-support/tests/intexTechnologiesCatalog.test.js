import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/intextechnologies/catalog.js')
  } catch {
    assert.fail('Expected Intex Technologies catalog module at ../../scraper/intextechnologies/catalog.js')
  }
}

const loadIntexModule = async () => {
  try {
    return await import('../../scraper/intextechnologies/script.js')
  } catch {
    assert.fail('Expected Intex Technologies scraper module at ../../scraper/intextechnologies/script.js')
  }
}

test('Intex Technologies local catalog captures the verified first-party careers page and shared Google Forms handoff', async () => {
  const { INTEX_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const intex = await loadIntexModule()

  assert.equal(INTEX_TECHNOLOGIES_CATALOG.source, 'intextechnologies')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.companyName, 'Intex Technologies')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.officialBrandName, 'Intex Technologies')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.adapter, 'script')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.modulePath, '../../scraper/intextechnologies/script.js')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.companyCareerPage, 'https://www.intex.in/pages/careers')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.homepageUrl, 'https://www.intex.in/')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.officialCareersPageUrl, 'https://www.intex.in/pages/careers')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.applicationUrl, 'https://forms.gle/8rznvixnmnNB4cnB9')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.companyDomain, 'intex.in')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.countryFilter, 'India')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.paginationStrategy, 'verified-first-party-careers-page-inline-openings')
  assert.equal(
    INTEX_TECHNOLOGIES_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+inline-opening-cards+shared-google-form-apply-surface',
  )
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.parser, 'custom-script')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(INTEX_TECHNOLOGIES_CATALOG.dryRunFile, 'intextechnologies/jobs.json')
  assert.match(INTEX_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.intex\.in\/pages\/careers/i)
  assert.match(INTEX_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /Branch Sales Manager/i)
  assert.match(INTEX_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /E - Commerce Manager/i)
  assert.match(INTEX_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /forms\.gle\/8rznvixnmnNB4cnB9/i)

  assert.equal(intex.PROVIDER_METADATA.source, INTEX_TECHNOLOGIES_CATALOG.source)
  assert.equal(intex.PROVIDER_METADATA.applicationUrl, INTEX_TECHNOLOGIES_CATALOG.applicationUrl)
})

test('Intex Technologies backlog row matches directly from the local catalog without alias churn', async () => {
  const { INTEX_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Intex Technologies\n',
    catalog: [INTEX_TECHNOLOGIES_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Intex Technologies', 'intextechnologies', 'Intex Technologies']],
  )
})

test('getScraperCatalog includes Intex Technologies as a verified first-party inline openings provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'intextechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Intex Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.intex.in/pages/careers')
  assert.equal(provider.companyDomain, 'intex.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /intextechnologies[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Intex Technologies scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'intextechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'intextechnologies')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /intextechnologies[\\/]jobs\.json$/i)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/5paisa/provider.js')
  } catch {
    return null
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/5paisa/script.js')
  } catch {
    return null
  }
}

test('5paisa exposes local provider metadata for the verified first-party careers scraper', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.ok(
    providerModule,
    'Expected 5paisa provider module at ../../scraper/5paisa/provider.js',
  )
  assert.ok(
    scriptModule,
    'Expected 5paisa scraper module at ../../scraper/5paisa/script.js',
  )

  assert.deepEqual(providerModule.provider, {
    source: '5paisa',
    companyName: '5paisa',
    adapter: 'script',
    modulePath: '../../scraper/5paisa/script.js',
    companyCareerPage: 'https://www.5paisa.com/careers',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'single-current-vacancies-page-plus-first-party-detail-pages',
    extractionStrategy:
      'verified-first-party-current-vacancies-list+india-role-filter+detail-pages+same-page-application-form',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: '5paisa.com',
    verifiedOn: '2026-07-14',
    verifiedSurfaceSummary:
      'Verified https://www.5paisa.com/careers exposes a first-party Current vacancies block for India roles, and each vacancy links to a first-party /careers/job-* detail page with role content plus an embedded application form.',
    dryRunFile: '5paisa/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('buildScrapers and company coverage resolve 5paisa from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === '5paisa')
  const scraper = buildScrapers().find((item) => item.name === '5paisa')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, '5paisa')
  assert.equal(provider.companyCareerPage, 'https://www.5paisa.com/careers')
  assert.match(scraper.dryRunFile, /5paisa[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: '5paisa\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['5paisa', '5paisa', '5paisa']],
  )
})

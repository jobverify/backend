import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/instamojo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/instamojo/catalog.js')
  } catch {
    assert.fail('Expected Instamojo catalog module at ../../scraper/instamojo/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/instamojo/script.js')
  } catch {
    assert.fail('Expected Instamojo scraper module at ../../scraper/instamojo/script.js')
  }
}

test('Instamojo local catalog captures the verified first-party team page and Recruiterflow board', async () => {
  const { INSTAMOJO_CATALOG } = await loadCatalogModule()
  const instamojo = await loadScraperModule()

  assert.equal(INSTAMOJO_CATALOG.source, 'instamojo')
  assert.equal(INSTAMOJO_CATALOG.companyName, 'Instamojo')
  assert.equal(INSTAMOJO_CATALOG.officialBrandName, 'Instamojo')
  assert.equal(INSTAMOJO_CATALOG.adapter, 'script')
  assert.equal(INSTAMOJO_CATALOG.companyCareerPage, 'https://www.instamojo.com/company/team/')
  assert.equal(INSTAMOJO_CATALOG.homepageUrl, 'https://www.instamojo.com/')
  assert.equal(INSTAMOJO_CATALOG.jobsBoardUrl, 'https://recruiterflow.com/instamojo/jobs')
  assert.equal(INSTAMOJO_CATALOG.verifiedSampleJobUrl, 'https://recruiterflow.com/instamojo/jobs/137')
  assert.equal(INSTAMOJO_CATALOG.atsPlatform, 'recruiterflow')
  assert.equal(INSTAMOJO_CATALOG.countryFilter, 'India')
  assert.equal(
    INSTAMOJO_CATALOG.paginationStrategy,
    'official-team-page-handoff-plus-recruiterflow-window-jobslist',
  )
  assert.equal(
    INSTAMOJO_CATALOG.extractionStrategy,
    'verified-team-page+verified-recruiterflow-board+window.jobsList',
  )
  assert.equal(INSTAMOJO_CATALOG.parser, 'custom-script')
  assert.equal(INSTAMOJO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INSTAMOJO_CATALOG.companyDomain, 'instamojo.com')
  assert.equal(INSTAMOJO_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(INSTAMOJO_CATALOG.verifiedPublicPostingCount, 5)
  assert.match(INSTAMOJO_CATALOG.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(INSTAMOJO_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.instamojo\.com\/company\/team\//i)
  assert.match(INSTAMOJO_CATALOG.verifiedSurfaceSummary, /https:\/\/recruiterflow\.com\/instamojo\/jobs/i)
  assert.match(INSTAMOJO_CATALOG.verifiedSurfaceSummary, /public Recruiterflow board/i)
  assert.equal(INSTAMOJO_CATALOG.modulePath, modulePath)
  assert.match(INSTAMOJO_CATALOG.dryRunFile, /instamojo[\\/]jobs\.json$/i)

  assert.equal(instamojo.PROVIDER_METADATA.source, INSTAMOJO_CATALOG.source)
  assert.equal(instamojo.PROVIDER_METADATA.companyName, INSTAMOJO_CATALOG.companyName)
  assert.equal(instamojo.PROVIDER_METADATA.companyCareerPage, INSTAMOJO_CATALOG.companyCareerPage)
  assert.equal(instamojo.PROVIDER_METADATA.jobsBoardUrl, INSTAMOJO_CATALOG.jobsBoardUrl)
})

test('Instamojo local catalog covers the exact backlog row without aliases', async () => {
  const { INSTAMOJO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Instamojo\n',
    catalog: [INSTAMOJO_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Instamojo', 'instamojo', 'Instamojo']],
  )
})

test('getScraperCatalog includes Instamojo as a verified Recruiterflow provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'instamojo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Instamojo')
  assert.equal(provider.companyCareerPage, 'https://www.instamojo.com/company/team/')
  assert.equal(provider.companyDomain, 'instamojo.com')
  assert.equal(provider.atsPlatform, 'recruiterflow')
  assert.match(provider.modulePath, /instamojo[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Instamojo scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'instamojo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'instamojo')
  assert.equal(scraper.provider.atsPlatform, 'recruiterflow')
  assert.match(scraper.dryRunFile, /instamojo[\\/]jobs\.json$/i)
})

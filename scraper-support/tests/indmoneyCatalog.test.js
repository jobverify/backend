import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/indmoney/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/indmoney/catalog.js')
  } catch {
    assert.fail('Expected INDmoney catalog module at ../../scraper/indmoney/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/indmoney/script.js')
  } catch {
    assert.fail('Expected INDmoney scraper module at ../../scraper/indmoney/script.js')
  }
}

test('INDmoney local catalog captures the verified about-page LinkedIn handoff and no-public-jobs sentinel contract', async () => {
  const { INDMONEY_CATALOG } = await loadCatalogModule()
  const indmoney = await loadScraperModule()

  assert.equal(INDMONEY_CATALOG.source, 'indmoney')
  assert.equal(INDMONEY_CATALOG.companyName, 'INDmoney')
  assert.equal(INDMONEY_CATALOG.officialBrandName, 'INDmoney')
  assert.equal(INDMONEY_CATALOG.adapter, 'script')
  assert.equal(INDMONEY_CATALOG.homepageUrl, 'https://www.indmoney.com/')
  assert.equal(INDMONEY_CATALOG.companyCareerPage, 'https://www.indmoney.com/about')
  assert.equal(INDMONEY_CATALOG.aboutPageUrl, 'https://www.indmoney.com/about')
  assert.equal(INDMONEY_CATALOG.linkedinJobsUrl, 'https://www.linkedin.com/company/indmoney/jobs/')
  assert.equal(INDMONEY_CATALOG.companyDomain, 'indmoney.com')
  assert.equal(INDMONEY_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(INDMONEY_CATALOG.countryFilter, 'India')
  assert.equal(
    INDMONEY_CATALOG.paginationStrategy,
    'verified-about-page-plus-linkedin-handoff-validation',
  )
  assert.equal(
    INDMONEY_CATALOG.extractionStrategy,
    'verified-cloudflare-challenge-on-homepage-and-about-page+legacy-official-about-page-linkedin-handoff+no-first-party-public-jobs-return-empty',
  )
  assert.equal(INDMONEY_CATALOG.parser, 'custom-script')
  assert.equal(INDMONEY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INDMONEY_CATALOG.verifiedOn, '2026-08-13')
  assert.match(INDMONEY_CATALOG.dryRunFile, /indmoney[\\/]jobs\.json$/i)
  assert.equal(INDMONEY_CATALOG.modulePath, modulePath)
  assert.match(INDMONEY_CATALOG.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(INDMONEY_CATALOG.verifiedSurfaceSummary, /Just a moment/i)
  assert.match(INDMONEY_CATALOG.verifiedSurfaceSummary, /Cloudflare/i)
  assert.match(INDMONEY_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.indmoney\.com\/about/i)

  assert.equal(indmoney.PROVIDER_METADATA.source, INDMONEY_CATALOG.source)
  assert.equal(indmoney.PROVIDER_METADATA.companyName, INDMONEY_CATALOG.companyName)
  assert.equal(indmoney.PROVIDER_METADATA.companyCareerPage, INDMONEY_CATALOG.companyCareerPage)
  assert.equal(indmoney.PROVIDER_METADATA.linkedinJobsUrl, INDMONEY_CATALOG.linkedinJobsUrl)
})

test('INDmoney exact backlog name matches from the local provider contract without aliases', async () => {
  const { INDMONEY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'INDmoney\n',
    catalog: [INDMONEY_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['INDmoney', 'indmoney', 'INDmoney']],
  )
})

test('getScraperCatalog includes INDmoney as a verified no-public-jobs sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indmoney')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'INDmoney')
  assert.equal(provider.companyCareerPage, 'https://www.indmoney.com/about')
  assert.equal(provider.companyDomain, 'indmoney.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /indmoney[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable INDmoney scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'indmoney')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indmoney')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /indmoney[\\/]jobs\.json$/i)
})

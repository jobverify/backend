import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hpcl/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hpcl/catalog.js')
  } catch {
    assert.fail('Expected HPCL catalog module at ../../scraper/hpcl/catalog.js')
  }
}

test('HPCL local catalog captures the verified first-party careers pages and official HTML openings surface', async () => {
  const {
    HPCL_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HPCL_CATALOG)

  assert.equal(defaultCatalog, HPCL_CATALOG)
  assert.equal(provider.source, 'hpcl')
  assert.equal(provider.companyName, 'HPCL')
  assert.equal(provider.officialBrandName, 'Hindustan Petroleum Corporation Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(HPCL_CATALOG.dryRunFile, 'hpcl/jobs.json')
  assert.match(provider.dryRunFile, /hpcl[\\/]jobs\.json$/i)
  assert.equal(provider.homepageUrl, 'https://www.hindustanpetroleum.com/')
  assert.equal(provider.companyCareerPage, 'https://www.hindustanpetroleum.com/careers')
  assert.equal(
    provider.officialJobOpeningsUrl,
    'https://www.hindustanpetroleum.com/job-openings',
  )
  assert.deepEqual(provider.verifiedApplyPortalUrls, [
    'https://jobs.hpcl.co.in/Recruit_New/recruitlogin.jsp',
    'https://pesb.gov.in/UserAccount/Login',
  ])
  assert.equal(provider.companyDomain, 'hindustanpetroleum.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-job-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-job-openings-page+html-opening-cards+stale-result-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.hindustanpetroleum\.com\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.hindustanpetroleum\.com\/job-openings/i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/jobs\.hpcl\.co\.in\/Recruit_New\/recruitlogin\.jsp/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /\bsix current opening cards\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\bstale result-oriented Recruitment of Officers 2026 card\b/i)
})

test('HPCL exact backlog name matches from the local provider contract without aliases', async () => {
  const { HPCL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'HPCL\n',
    catalog: [hydrateProviderCatalogEntry(HPCL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HPCL', 'hpcl', 'HPCL']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'HPCL'), false)
})

test('getScraperCatalog includes HPCL as a verified first-party careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hpcl')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HPCL')
  assert.equal(provider.companyCareerPage, 'https://www.hindustanpetroleum.com/careers')
  assert.equal(provider.companyDomain, 'hindustanpetroleum.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /hpcl[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable HPCL scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hpcl')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hpcl')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /hpcl[\\/]jobs\.json$/i)
})

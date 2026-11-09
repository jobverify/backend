import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const hotfootModulePath = path.resolve(currentDir, '../../scraper/hotfoottechnology/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hotfoottechnology/catalog.js')
  } catch {
    assert.fail('Expected Hotfoot Technology catalog module at ../../scraper/hotfoottechnology/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hotfoottechnology/script.js')
  } catch {
    assert.fail('Expected Hotfoot Technology scraper module at ../../scraper/hotfoottechnology/script.js')
  }
}

test('Hotfoot Technology local catalog captures the verified placeholder-and-stale-route no-public-jobs contract', async () => {
  const { HOTFOOT_TECHNOLOGY_CATALOG } = await loadCatalogModule()
  const hotfoot = await loadScriptModule()

  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.source, 'hotfoottechnology')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.companyName, 'Hotfoot Technology')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.officialBrandName, 'Hotfoot Technology Solutions')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.adapter, 'script')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.companyCareerPage, 'https://hotfoot.co.in/job-openings/')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.homepageUrl, 'https://hotfoot.co.in/')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.jobsPageUrl, 'https://hotfoot.co.in/job-openings/')
  assert.deepEqual(HOTFOOT_TECHNOLOGY_CATALOG.staleJobDetailRouteUrls, [
    'https://hotfoot.co.in/blog/job-openings/devops-engineer/',
    'https://hotfoot.co.in/blog/job-openings/senior-business-analyst/',
  ])
  assert.deepEqual(HOTFOOT_TECHNOLOGY_CATALOG.staleJobArchiveRouteUrls, [
    'https://hotfoot.co.in/blog/category/job-openings/',
  ])
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.companyDomain, 'hotfoot.co.in')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.countryFilter, 'India')
  assert.equal(
    HOTFOOT_TECHNOLOGY_CATALOG.paginationStrategy,
    'verified-job-openings-placeholder-plus-stale-route-validation',
  )
  assert.equal(
    HOTFOOT_TECHNOLOGY_CATALOG.extractionStrategy,
    'verified-first-party-job-openings-page-with-placeholder-shortcode+verified-stale-job-detail-routes-return-empty',
  )
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.parser, 'custom-script')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.dryRunFile, 'hotfoottechnology/jobs.json')
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.verifiedOn, '2026-07-16')
  assert.match(HOTFOOT_TECHNOLOGY_CATALOG.verifiedSurfaceSummary, /https:\/\/hotfoot\.co\.in\/job-openings\//i)
  assert.match(HOTFOOT_TECHNOLOGY_CATALOG.verifiedSurfaceSummary, /\[awsmjobs\]/i)
  assert.match(HOTFOOT_TECHNOLOGY_CATALOG.verifiedSurfaceSummary, /stale search-engine snippets/i)
  assert.match(HOTFOOT_TECHNOLOGY_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(HOTFOOT_TECHNOLOGY_CATALOG.modulePath, hotfootModulePath)

  assert.equal(hotfoot.PROVIDER_METADATA.source, HOTFOOT_TECHNOLOGY_CATALOG.source)
  assert.equal(hotfoot.PROVIDER_METADATA.companyCareerPage, HOTFOOT_TECHNOLOGY_CATALOG.companyCareerPage)
})

test('Hotfoot Technology exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { HOTFOOT_TECHNOLOGY_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Hotfoot Technology\n',
    catalog: [HOTFOOT_TECHNOLOGY_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hotfoot Technology', 'hotfoottechnology', 'Hotfoot Technology']],
  )
})

test('getScraperCatalog includes Hotfoot Technology as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hotfoottechnology')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hotfoot Technology')
  assert.equal(provider.companyCareerPage, 'https://hotfoot.co.in/job-openings/')
  assert.equal(provider.companyDomain, 'hotfoot.co.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /hotfoottechnology[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hotfoot Technology scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hotfoottechnology')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hotfoottechnology')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /hotfoottechnology[\\/]jobs\.json$/i)
})

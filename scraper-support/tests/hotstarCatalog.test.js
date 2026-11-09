import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hotstar.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hotstar.workday/catalog.js')
  } catch {
    assert.fail('Expected Hotstar catalog module at ../../scraper/hotstar.workday/catalog.js')
  }
}

test('Hotstar local catalog captures the verified live JioStar page and keyworded Workday surface', async () => {
  const {
    HOTSTAR_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HOTSTAR_CATALOG)

  assert.equal(defaultCatalog, HOTSTAR_CATALOG)
  assert.equal(provider.source, 'hotstar')
  assert.equal(provider.companyName, 'Hotstar')
  assert.equal(provider.officialBrandName, 'JioHotstar')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(HOTSTAR_CATALOG.dryRunFile, 'hotstar.workday/jobs.json')
  assert.match(provider.dryRunFile, /hotstar.workday[\\/]jobs\.json$/i)
  assert.equal(provider.homepageUrl, 'https://www.hotstar.com/')
  assert.equal(provider.companyCareerPage, 'https://www.jiostar.com/')
  assert.equal(provider.companyDomain, 'hotstar.com')
  assert.equal(
    provider.officialWorkdayBoardUrl,
    'https://jiostar.wd102.myworkdayjobs.com/JioStar',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://jiostar.wd102.myworkdayjobs.com/wday/cxs/jiostar/JioStar/jobs',
  )
  assert.equal(provider.verifiedKeyword, 'JioHotstar')
  assert.equal(
    provider.verifiedJobUrl,
    'https://jiostar.wd102.myworkdayjobs.com/JioStar/job/Bengaluru---EGL/Senior-Director---Marketing--JioHotstar--South-_JR12076',
  )
  assert.equal(
    provider.verifiedApplyUrl,
    'https://jiostar.wd102.myworkdayjobs.com/JioStar/job/Bengaluru---EGL/Senior-Director---Marketing--JioHotstar--South-_JR12076/apply',
  )
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-live-careers-page-plus-keyworded-workday-search',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-hotstar-brand-homepage+verified-live-jiostar-page+verified-workday-board+keyworded-workday-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-17')
  assert.equal(provider.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.hotstar\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.jiostar\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /live JioStar corporate page/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /public Workday careers handoff/i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/jiostar\.wd102\.myworkdayjobs\.com\/JioStar/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/jiostar\.wd102\.myworkdayjobs\.com\/wday\/cxs\/jiostar\/JioStar\/jobs/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b96 keyword matches\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /searchText=JioHotstar/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /tech-jobs\.hotstar\.com/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Hotstar\n',
    catalog: [provider],
  })
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hotstar'), false)
})

test('getScraperCatalog includes Hotstar as a verified JioStar Workday provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hotstar')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hotstar')
  assert.equal(provider.companyCareerPage, 'https://www.jiostar.com/')
  assert.equal(provider.companyDomain, 'hotstar.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.match(provider.modulePath, /hotstar\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hotstar scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hotstar')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hotstar')
  assert.equal(scraper.provider.atsPlatform, 'workday')
  assert.match(scraper.dryRunFile, /hotstar.workday[\\/]jobs\.json$/i)
})

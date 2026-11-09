import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fraazoModulePath = path.resolve(currentDir, '../../scraper/fraazo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fraazo/catalog.js')
  } catch {
    assert.fail('Expected Fraazo catalog module at ../../scraper/fraazo/catalog.js')
  }
}

const loadFraazoModule = async () => {
  try {
    return await import('../../scraper/fraazo/script.js')
  } catch {
    assert.fail('Expected Fraazo scraper module at ../../scraper/fraazo/script.js')
  }
}

test('Fraazo local catalog captures the verified timeout-only first-party surface', async () => {
  const { FRAAZO_CATALOG } = await loadCatalogModule()
  const fraazo = await loadFraazoModule()

  assert.equal(FRAAZO_CATALOG.source, 'fraazo')
  assert.equal(FRAAZO_CATALOG.companyName, 'Fraazo')
  assert.equal(FRAAZO_CATALOG.officialBrandName, 'Fraazo')
  assert.equal(FRAAZO_CATALOG.adapter, 'script')
  assert.equal(FRAAZO_CATALOG.homepageUrl, 'https://fraazo.com/')
  assert.equal(FRAAZO_CATALOG.wwwHomepageUrl, 'https://www.fraazo.com/')
  assert.equal(FRAAZO_CATALOG.companyCareerPage, 'https://fraazo.com/careers')
  assert.equal(FRAAZO_CATALOG.wwwCareerPageUrl, 'https://www.fraazo.com/careers')
  assert.equal(FRAAZO_CATALOG.jobsUrl, 'https://fraazo.com/jobs')
  assert.equal(FRAAZO_CATALOG.wwwJobsUrl, 'https://www.fraazo.com/jobs')
  assert.equal(FRAAZO_CATALOG.robotsUrl, 'https://fraazo.com/robots.txt')
  assert.equal(FRAAZO_CATALOG.wwwRobotsUrl, 'https://www.fraazo.com/robots.txt')
  assert.equal(FRAAZO_CATALOG.sitemapUrl, 'https://fraazo.com/sitemap.xml')
  assert.equal(FRAAZO_CATALOG.wwwSitemapUrl, 'https://www.fraazo.com/sitemap.xml')
  assert.deepEqual(FRAAZO_CATALOG.timeoutProbeUrls, [
    'https://fraazo.com/',
    'https://www.fraazo.com/',
    'https://fraazo.com/careers',
    'https://www.fraazo.com/careers',
    'https://fraazo.com/career',
    'https://www.fraazo.com/career',
    'https://fraazo.com/jobs',
    'https://www.fraazo.com/jobs',
    'https://fraazo.com/join-us',
    'https://www.fraazo.com/join-us',
    'https://fraazo.com/openings',
    'https://www.fraazo.com/openings',
    'https://fraazo.com/work-with-us',
    'https://www.fraazo.com/work-with-us',
    'https://fraazo.com/robots.txt',
    'https://www.fraazo.com/robots.txt',
    'https://fraazo.com/sitemap.xml',
    'https://www.fraazo.com/sitemap.xml',
  ])
  assert.equal(FRAAZO_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(FRAAZO_CATALOG.companyDomain, 'fraazo.com')
  assert.equal(FRAAZO_CATALOG.countryFilter, 'India')
  assert.equal(
    FRAAZO_CATALOG.paginationStrategy,
    'verified-first-party-home-careers-and-discovery-route-timeout-validation',
  )
  assert.equal(
    FRAAZO_CATALOG.extractionStrategy,
    'verified-homepage-timeouts+verified-careers-route-timeouts+verified-robots-and-sitemap-timeouts-return-empty',
  )
  assert.equal(FRAAZO_CATALOG.parser, 'custom-script')
  assert.equal(FRAAZO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FRAAZO_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(FRAAZO_CATALOG.dryRunFile, 'fraazo/jobs.json')
  assert.match(FRAAZO_CATALOG.verifiedSurfaceSummary, /https:\/\/fraazo\.com\//i)
  assert.match(FRAAZO_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.fraazo\.com\//i)
  assert.match(FRAAZO_CATALOG.verifiedSurfaceSummary, /https:\/\/fraazo\.com\/careers/i)
  assert.match(FRAAZO_CATALOG.verifiedSurfaceSummary, /https:\/\/fraazo\.com\/jobs/i)
  assert.match(FRAAZO_CATALOG.verifiedSurfaceSummary, /https:\/\/fraazo\.com\/robots\.txt/i)
  assert.match(FRAAZO_CATALOG.verifiedSurfaceSummary, /https:\/\/fraazo\.com\/sitemap\.xml/i)
  assert.match(FRAAZO_CATALOG.verifiedSurfaceSummary, /timed out/i)
  assert.match(FRAAZO_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(FRAAZO_CATALOG.modulePath, fraazoModulePath)

  assert.equal(fraazo.PROVIDER_METADATA.source, FRAAZO_CATALOG.source)
  assert.equal(fraazo.PROVIDER_METADATA.companyCareerPage, FRAAZO_CATALOG.companyCareerPage)
  assert.deepEqual(fraazo.PROVIDER_METADATA.timeoutProbeUrls, FRAAZO_CATALOG.timeoutProbeUrls)
})

test('Fraazo backlog row hydrates locally from the local provider contract', async () => {
  const { FRAAZO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FRAAZO_CATALOG)

  assert.equal(provider.companyName, 'Fraazo')
  assert.equal(provider.companyDomain, 'fraazo.com')
  assert.match(provider.modulePath, /fraazo[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /fraazo[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Fraazo\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fraazo', 'fraazo', 'Fraazo']],
  )
})

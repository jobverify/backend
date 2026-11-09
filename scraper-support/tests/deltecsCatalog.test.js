import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/deltecs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/deltecs/catalog.js')
  } catch {
    assert.fail('Expected Deltecs catalog module at ../../scraper/deltecs/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/deltecs/script.js')
  } catch {
    assert.fail('Expected Deltecs scraper module at ../../scraper/deltecs/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Deltecs local catalog captures the verified DronaHQ first-party jobs surface tied to Deltecs Infotech', async () => {
  const { DELTECS_CATALOG } = await loadCatalogModule()
  const deltecs = await loadScraperModule()
  const provider = buildCatalogReadyProvider(DELTECS_CATALOG)

  assert.equal(provider.source, 'deltecs')
  assert.equal(provider.companyName, 'Deltecs')
  assert.equal(provider.officialBrandName, 'Deltecs Infotech Pvt Ltd')
  assert.equal(provider.publicBrandName, 'DronaHQ')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.dronahq.com/')
  assert.equal(provider.companyCareerPage, 'https://www.dronahq.com/careers/')
  assert.equal(provider.companyDomain, 'dronahq.com')
  assert.equal(provider.careersSitemapUrl, 'https://www.dronahq.com/career-sitemap.xml')
  assert.deepEqual(provider.verifiedJobUrls, [
    'https://www.dronahq.com/career/b2b-tech-marketing-intern-developer-platform/',
    'https://www.dronahq.com/career/qa-lead/',
    'https://www.dronahq.com/career/legal-executive/',
    'https://www.dronahq.com/career/b2b-saas-marketer/',
  ])
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-plus-first-party-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-dronahq-homepage+verified-deltecs-brand-signals+verified-careers-page+first-party-job-cards+first-party-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dronahq\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dronahq\.com\/careers\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/www\.dronahq\.com\/career\/b2b-tech-marketing-intern-developer-platform\//i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Deltecs Infotech Pvt Ltd/i)
  assert.match(provider.verifiedSurfaceSummary, /\b4 public openings\b/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /deltecs[\\/]jobs\.json$/i)

  assert.equal(deltecs.PROVIDER_METADATA.source, provider.source)
  assert.equal(deltecs.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(deltecs.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(deltecs.PROVIDER_METADATA.publicBrandName, provider.publicBrandName)
})

test('Deltecs exact backlog name matches from the local provider contract without aliases', async () => {
  const { DELTECS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Deltecs\n',
    catalog: [buildCatalogReadyProvider(DELTECS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Deltecs', 'deltecs', 'Deltecs']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Deltecs'), false)
})

test('buildScrapers and company coverage resolve Deltecs from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'deltecs')
  const scraper = buildScrapers().find((item) => item.name === 'deltecs')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Deltecs')
  assert.equal(provider.companyCareerPage, 'https://www.dronahq.com/careers/')
  assert.match(scraper.dryRunFile, /deltecs[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Deltecs\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Deltecs', 'deltecs', 'Deltecs']],
  )
})

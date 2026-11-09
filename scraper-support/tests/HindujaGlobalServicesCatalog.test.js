import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hindujaglobalservices/catalog.js')
  } catch {
    assert.fail('Expected Hinduja Global Services catalog module at ../../scraper/hindujaglobalservices/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hindujaglobalservices/script.js')
  } catch {
    assert.fail('Expected Hinduja Global Services scraper module at ../../scraper/hindujaglobalservices/script.js')
  }
}

test('Hinduja Global Services local catalog captures the verified first-party landing, category pages, and RSS feeds', async () => {
  const { HINDUJA_GLOBAL_SERVICES_CATALOG } = await loadCatalogModule()
  const hgs = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(HINDUJA_GLOBAL_SERVICES_CATALOG)

  assert.equal(provider.source, 'hindujaglobalservices')
  assert.equal(provider.companyName, 'Hinduja Global Services')
  assert.equal(provider.officialBrandName, 'Hinduja Global Solutions Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.joinhgs.com/in/en')
  assert.equal(provider.companyDomain, 'joinhgs.com')
  assert.equal(
    provider.bpmCategoryPageUrl,
    'https://careers.joinhgs.com/India/go/BPM-Jobs-India/7947010/',
  )
  assert.equal(
    provider.digitalCategoryPageUrl,
    'https://careers.joinhgs.com/India/go/Digital-Data-And-Analytics-Jobs-India/7947110/',
  )
  assert.equal(
    provider.bpmJobsRssUrl,
    'https://careers.joinhgs.com/services/rss/category/?catid=7947010',
  )
  assert.equal(
    provider.digitalJobsRssUrl,
    'https://careers.joinhgs.com/services/rss/category/?catid=7947110',
  )
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://careers.joinhgs.com/India/job/Bengaluru-Urban-Trainee-Process-Consultant-KA-560068/1367615866/',
  )
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.verifiedIndiaJobCount, 1)
  assert.equal(provider.atsPlatform, 'jobs2web-rss')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-landing-plus-linked-category-rss-feeds',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-joinhgs-landing+verified-category-pages+jobs2web-rss-feeds+india-job-normalization',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.modulePath, /hindujaglobalservices[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /hindujaglobalservices[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /HGS India landing/i)
  assert.match(provider.verifiedSurfaceSummary, /both category pages/i)
  assert.match(provider.verifiedSurfaceSummary, /public RSS feeds/i)
  assert.match(provider.verifiedSurfaceSummary, /Process Consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /one Trainee Process Consultant/i)

  assert.equal(hgs.PROVIDER_METADATA.source, provider.source)
  assert.equal(hgs.CAREERS_URL, provider.companyCareerPage)
  assert.equal(hgs.BPM_CATEGORY_PAGE_URL, provider.bpmCategoryPageUrl)
  assert.equal(hgs.DIGITAL_CATEGORY_PAGE_URL, provider.digitalCategoryPageUrl)
  assert.equal(hgs.BPM_JOBS_RSS_URL, provider.bpmJobsRssUrl)
  assert.equal(hgs.DIGITAL_JOBS_RSS_URL, provider.digitalJobsRssUrl)
})

test('Hinduja Global Services exact-name rows and the Hinduja Global Solutions backlog alias resolve to the same provider', async () => {
  const { HINDUJA_GLOBAL_SERVICES_CATALOG } = await loadCatalogModule()
  assert.equal(companyAliases['Hinduja Global Solutions'], 'hindujaglobalservices')
  assert.equal(companyAliases['Hinduja Global Solutions Ltd'], 'hindujaglobalservices')

  const report = generateCompanyCoverageReport({
    csvText: 'Hinduja Global Services\nHinduja Global Solutions\nHinduja Global Solutions Ltd\n',
    catalog: [hydrateProviderCatalogEntry(HINDUJA_GLOBAL_SERVICES_CATALOG)],
    aliasMap: companyAliases,
  })

  assert.equal(report.totalRows, 3)
  assert.equal(report.candidateRows, 3)
  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Hinduja Global Services', 'hindujaglobalservices', 'Hinduja Global Services'],
      ['Hinduja Global Solutions', 'hindujaglobalservices', 'Hinduja Global Services'],
      ['Hinduja Global Solutions Ltd', 'hindujaglobalservices', 'Hinduja Global Services'],
    ],
  )
})

test('getScraperCatalog includes Hinduja Global Services as a verified Jobs2Web RSS provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hindujaglobalservices')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hinduja Global Services')
  assert.equal(provider.companyCareerPage, 'https://www.joinhgs.com/in/en')
  assert.equal(provider.companyDomain, 'joinhgs.com')
  assert.equal(provider.atsPlatform, 'jobs2web-rss')
  assert.match(provider.modulePath, /hindujaglobalservices[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hinduja Global Services scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hindujaglobalservices')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hindujaglobalservices')
  assert.equal(scraper.provider.atsPlatform, 'jobs2web-rss')
  assert.match(scraper.dryRunFile, /hindujaglobalservices[\\/]jobs\.json$/i)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAeonCatalog = async () => {
  try {
    return await import('../../scraper/aeon/catalog.js')
  } catch {
    assert.fail('Expected AEON catalog module at ../../scraper/aeon/catalog.js')
  }
}

test('AEON provider metadata captures the verified India careers hub and blocked public PeopleStrong handoff without aliases', async () => {
  const { AEON_CATALOG } = await loadAeonCatalog()
  const provider = hydrateProviderCatalogEntry(AEON_CATALOG)

  assert.equal(provider.source, 'aeon')
  assert.equal(provider.companyName, 'AEON')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.aeoncredit.co.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-careers-pages-plus-blocked-peoplestrong-handoff')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-hub+verified-join-us-page+declared-peoplestrong-access-failure-with-unknown-inventory',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aeoncredit.co.in')
  assert.match(provider.modulePath, /aeon[\\/]script\.js$/i)
  assert.equal(provider.officialBrandName, 'Aeon Credit')
  assert.equal(provider.legalEntityName, 'AEON Credit Service India Pvt. Ltd.')
  assert.match(provider.verifiedSurfaceSummary, /July 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.aeoncredit\.co\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.aeoncredit\.co\.in\/careers\/join-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers-aeoncredit\.peoplestrong\.com\/job\/joblist/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'AEON'), false)
})

test('AEON backlog row matches directly from provider metadata without alias churn', async () => {
  const { AEON_CATALOG } = await loadAeonCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'AEON\n',
    catalog: [hydrateProviderCatalogEntry(AEON_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AEON', 'aeon', 'AEON']],
  )
})

test('buildScrapers and company coverage resolve AEON from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aeon')
  const scraper = buildScrapers().find((item) => item.name === 'aeon')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AEON')
  assert.equal(provider.companyCareerPage, 'https://www.aeoncredit.co.in/careers')
  assert.match(scraper.dryRunFile, /aeon[\\/]jobs\.json$/i)
  assert.match(provider.extractionStrategy, /access-failure-with-unknown-inventory/)

  const report = generateCompanyCoverageReport({
    csvText: 'AEON\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AEON', 'aeon', 'AEON']],
  )
})

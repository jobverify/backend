import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import {
  CAREERS_URLS,
  COMPANY,
  HOMEPAGE_URL,
  SITEMAP_URL,
  SOURCE,
  VERIFIED_ON,
  VERIFIED_SURFACE_SUMMARY,
  run,
} from '../../scraper/codenation/script.js'

test('getScraperCatalog includes Code Nation as a verified first-party no-public-jobs sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider)
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, HOMEPAGE_URL)
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage+sitemap+404-careers-routes-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-sitemap+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'codenation.com')
  assert.match(provider.modulePath, /codenation[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /codenation[\\/]jobs\.json$/i)
  assert.equal(typeof run, 'function')
  assert.equal(VERIFIED_ON, '2026-07-14')
  assert.equal(SITEMAP_URL, 'https://www.codenation.com/sitemap.xml')
  assert.deepEqual(CAREERS_URLS, [
    'https://www.codenation.com/careers',
    'https://www.codenation.com/jobs',
  ])
  assert.match(VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
})

test('buildScrapers and company coverage resolve both Codenation and Code Nation rows', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.match(scraper.dryRunFile, /codenation[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Codenation,\nCode Nation,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Codenation', 'codenation', 'Code Nation'],
      ['Code Nation', 'codenation', 'Code Nation'],
    ],
  )
})

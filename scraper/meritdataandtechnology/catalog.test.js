import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'meritdataandtechnology'
const COMPANY = 'Merit Data & Technology'

test('Merit Data & Technology is registered as a verified placeholder-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Merit Data & Technology provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, 'https://meritdata-tech.com/')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://meritdata-tech.com/sitemap.xml',
    'https://meritdata-tech.com/draft-templates/careers',
    'https://meritdata-tech.com/careers',
    'https://meritdata-tech.com/jobs',
    'https://meritdata-tech.com/career',
    'https://meritdata-tech.com/join-us',
    'https://meritdata-tech.com/work-with-us',
    'https://meritdata-tech.com/open-positions',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-plus-placeholder-careers-template-and-404-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-without-careers-nav+verified-sitemap-placeholder-careers-url+verified-draft-careers-demo-page+verified-careers-routes-404-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'meritdata-tech.com')
  assert.match(provider.modulePath, /meritdataandtechnology[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Merit Data & Technology resolves directly from provider metadata and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY}\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Merit Data & Technology scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, 'https://meritdata-tech.com/')
  assert.match(scraper.dryRunFile, /meritdataandtechnology[\\/]jobs\.json$/i)
})

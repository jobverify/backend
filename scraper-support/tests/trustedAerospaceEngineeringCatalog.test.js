import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Trusted Aerospace Engineering on the verified official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'trustedaerospaceengineering')

  assert.ok(provider, 'Expected Trusted Aerospace Engineering provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Trusted Aerospace Engineering Private Limited')
  assert.equal(provider.companyCareerPage, 'https://www.taseglobal.com/career.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-global-careers-page-with-india-section')
  assert.equal(
    provider.extractionStrategy,
    'verified-global-careers-page+india-accordion-roles+shared-first-party-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'taseglobal.com')
  assert.match(provider.modulePath, /trustedaerospaceengineering[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Trusted Aerospace Engineering Private Limited'),
    false,
  )
})

test('buildScrapers exposes a runnable Trusted Aerospace Engineering scraper and exact coverage works without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'trustedaerospaceengineering')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'trustedaerospaceengineering')
  assert.match(scraper.dryRunFile, /trustedaerospaceengineering[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: [
      'Trusted Aerospace Engineering Private Limited,',
      'Trusted Aerospace Engineering Pvt Ltd,',
    ].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      [
        'Trusted Aerospace Engineering Private Limited',
        'trustedaerospaceengineering',
        'Trusted Aerospace Engineering Private Limited',
      ],
      [
        'Trusted Aerospace Engineering Pvt Ltd',
        'trustedaerospaceengineering',
        'Trusted Aerospace Engineering Private Limited',
      ],
    ],
  )
})

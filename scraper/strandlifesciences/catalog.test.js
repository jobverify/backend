import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Strand Life Sciences is registered as a verified first-party careers-form sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'strandlifesciences')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Strand Life Sciences')
  assert.equal(provider.companyCareerPage, 'https://us.strandls.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-and-privacy-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+verified-privacy-page+application-form+no-public-job-records',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'us.strandls.com')
  assert.match(provider.modulePath, /strandlifesciences[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Strand Life Sciences'), false)
})

test('Strand Life Sciences Pvt. Ltd resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Strand Life Sciences Pvt. Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Strand Life Sciences Pvt. Ltd', 'strandlifesciences', 'Strand Life Sciences']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'strandlifesciences')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'strandlifesciences')
  assert.equal(scraper.provider.companyCareerPage, 'https://us.strandls.com/careers')
  assert.match(scraper.dryRunFile, /strandlifesciences[\\/]jobs\.json$/i)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Sagar Defence Engineering is registered as a verified first-party email-only careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sagardefence')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sagar Defence Engineering')
  assert.equal(provider.companyCareerPage, 'https://www.sagardefence.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-and-contact-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-email-only-careers-page+verified-contact-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sagardefence.com')
  assert.match(provider.modulePath, /sagardefence[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sagar Defence Engineering'), false)
})

test('Sagar Defence Engineering resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Sagar Defence Engineering\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sagar Defence Engineering', 'sagardefence', 'Sagar Defence Engineering']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'sagardefence')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sagardefence')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.sagardefence.com/careers/')
  assert.match(scraper.dryRunFile, /sagardefence[\\/]jobs\.json$/i)
})

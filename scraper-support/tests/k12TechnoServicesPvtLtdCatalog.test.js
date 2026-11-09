import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('K12 Techno Services Pvt. Ltd. is registered as a first-party script provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'k12technoservicespvtltd')

  assert.ok(provider, 'Expected K12 Techno Services Pvt. Ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'K12 Techno Services Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.orchidsinternationalschool.com/we-are-hiring')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-hiring-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-hiring-page+inline-role-categories+onsite-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'orchidsinternationalschool.com')
  assert.match(provider.modulePath, /k12technoservicespvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'K12 Techno Services Pvt. Ltd.'), false)
})

test('K12 Techno Services Pvt. Ltd. matches coverage directly from provider metadata and is runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'K12 Techno Services Pvt. Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['K12 Techno Services Pvt. Ltd.', 'k12technoservicespvtltd', 'K12 Techno Services Pvt. Ltd.']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'k12technoservicespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the K12 Techno Services Pvt. Ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'k12technoservicespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.orchidsinternationalschool.com/we-are-hiring')
  assert.match(scraper.dryRunFile, /k12technoservicespvtltd[\\/]jobs\.json$/i)
})

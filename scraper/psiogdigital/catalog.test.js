import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Psiog Digital is registered against its verified first-party Zoho Recruit handoff without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'psiogdigital')

  assert.ok(provider, 'Expected Psiog Digital provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Psiog Digital')
  assert.equal(provider.companyCareerPage, 'https://psiog.zohorecruit.in/jobs/Careers')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-json-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-about-page+verified-careers-page+verified-recruitment-handoff+verified-first-party-zoho-portal+zoho-public-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'psiog.zohorecruit.in')
  assert.match(provider.modulePath, /psiogdigital[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Psiog Digital'), false)
})

test('Psiog Digital resolves from provider metadata and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Psiog Digital,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Psiog Digital', 'psiogdigital', 'Psiog Digital']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'psiogdigital')

  assert.ok(scraper, 'Expected buildScrapers() to return the Psiog Digital scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'psiogdigital')
  assert.equal(scraper.provider.companyCareerPage, 'https://psiog.zohorecruit.in/jobs/Careers')
  assert.match(scraper.dryRunFile, /psiogdigital[\\/]jobs\.json$/i)
})

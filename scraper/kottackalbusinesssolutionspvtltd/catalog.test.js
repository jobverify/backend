import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'kottackalbusinesssolutionspvtltd'
const COMPANY = 'Kottackal Business Solutions Pvt. Ltd'
const HOMEPAGE_URL = 'https://kottackalbusinesssolutions.com/'

test('Kottackal Business Solutions Pvt. Ltd is registered as a verified unresolved-host sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Kottackal Business Solutions Pvt. Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, HOMEPAGE_URL)
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.kottackalbusinesssolutions.com/',
    'https://kottackalbusinesssolutions.in/',
    'https://www.kottackalbusinesssolutions.in/',
    'https://kottackalbusinesssolutions.co.in/',
    'https://www.kottackalbusinesssolutions.co.in/',
    'https://kottackalbusinesssolutionspvtltd.com/',
    'https://www.kottackalbusinesssolutionspvtltd.com/',
    'https://kottackalbusinesssolutionspvtltd.in/',
    'https://www.kottackalbusinesssolutionspvtltd.in/',
    'https://kottackalbusinesssolutionspvtltd.co.in/',
    'https://www.kottackalbusinesssolutionspvtltd.co.in/',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'canonical-first-party-host-resolution-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-hosts-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kottackalbusinesssolutions.com')
  assert.match(provider.modulePath, /kottackalbusinesssolutionspvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Kottackal Business Solutions Pvt. Ltd matches company coverage directly from provider metadata', () => {
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
})

test('Kottackal Business Solutions Pvt. Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Kottackal Business Solutions Pvt. Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, HOMEPAGE_URL)
  assert.match(scraper.dryRunFile, /kottackalbusinesssolutionspvtltd[\\/]jobs\.json$/i)
})

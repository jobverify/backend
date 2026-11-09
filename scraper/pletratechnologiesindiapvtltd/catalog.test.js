import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'pletratechnologiesindiapvtltd'
const COMPANY = 'Pletra Technologies India Pvt. Ltd.'
const CAREERS_URL = 'https://pletratech.com/careers-pletra-technologies/'

test('Pletra Technologies India Pvt. Ltd. is registered against the verified first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Pletra provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-contact-page-plus-first-party-careers-page-plus-alias-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-india-contact-page+verified-careers-accordion+country-filtered-inline-openings+verified-careers-alias',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pletratech.com')
  assert.match(provider.modulePath, /pletratechnologiesindiapvtltd[\\/]script\.js$/i)
})

test('Pletra Technologies India Pvt. Ltd. matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY},\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )
})

test('Pletra Technologies India Pvt. Ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Pletra scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_URL)
  assert.match(scraper.dryRunFile, /pletratechnologiesindiapvtltd[\\/]jobs\.json$/i)
})

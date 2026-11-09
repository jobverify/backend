import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'technologicsglobalresearchproject'
const COMPANY = 'Technologics Global Research & Project'
const ALTERNATE_CAREER_PAGES = [
  'https://technologicsglobalresearchproject.com/',
  'https://www.technologicsglobalresearchproject.com/',
  'https://technologicsglobalresearchproject.in/',
  'https://www.technologicsglobalresearchproject.in/',
  'https://technologicsglobalresearchandproject.com/',
  'https://www.technologicsglobalresearchandproject.com/',
  'https://technologicsglobalresearchandproject.in/',
  'https://www.technologicsglobalresearchandproject.in/',
]

test('Technologics Global Research & Project is registered as an unresolved first-party sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Technologics Global Research & Project provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, null)
  assert.deepEqual(provider.alternateCareerPages, ALTERNATE_CAREER_PAGES)
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-first-party-host-resolution-validation')
  assert.equal(provider.extractionStrategy, 'verified-candidate-first-party-hosts-unresolved-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, null)
  assert.match(provider.modulePath, /technologicsglobalresearchproject[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Technologics Global Research & Project matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
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

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Technologics Global Research & Project scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, null)
  assert.match(scraper.dryRunFile, /technologicsglobalresearchproject[\\/]jobs\.json$/i)
})

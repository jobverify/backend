import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const SOURCE = 'cccunderwaterengineeringabudhabi'

test('getScraperCatalog includes CCC Underwater Engineering, Abu Dhabi as an exact-name first-party CV-form monitor', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected CCC Underwater Engineering, Abu Dhabi provider to be registered')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CCC Underwater Engineering, Abu Dhabi')
  assert.equal(provider.companyCareerPage, 'https://www.ccc.net/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'United Arab Emirates')
  assert.equal(
    provider.paginationStrategy,
    'verified-group-homepage-plus-contact-page-plus-first-party-cv-form',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-ccc-homepage+verified-underwater-abu-dhabi-contact-entry+verified-first-party-cv-form-without-public-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ccc.net')
  assert.match(provider.modulePath, /cccunderwaterengineeringabudhabi[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'CCC Underwater Engineering, Abu Dhabi'),
    false,
  )
})

test('company coverage resolves the exact CCC Underwater Engineering, Abu Dhabi CSV lane without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'CCC Underwater Engineering, Abu Dhabi,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'CCC Underwater Engineering, Abu Dhabi',
      SOURCE,
      'CCC Underwater Engineering, Abu Dhabi',
    ]],
  )
})

test('buildScrapers exposes CCC Underwater Engineering, Abu Dhabi as a runnable lane scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the CCC Underwater Engineering, Abu Dhabi scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ccc.net/careers/')
  assert.match(scraper.dryRunFile, /cccunderwaterengineeringabudhabi[\\/]jobs\.json$/i)
})

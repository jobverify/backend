import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Ninestars Information Technologies Pvt Ltd is registered against the verified first-party careers handoff and bundle-backed jobs surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ninestarsinformationtechnologiespvtltd')

  assert.ok(provider, 'Expected Ninestars Information Technologies Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Ninestars Information Technologies Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://career.ninestarsglobal.com/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-handoff-plus-client-bundle-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-shell+verified-careers-handoff-shell+verified-client-bundle-static-openings-array',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ninestarsglobal.com')
  assert.match(provider.modulePath, /ninestarsinformationtechnologiespvtltd[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Ninestars Information Technologies Pvt Ltd'),
    false,
  )
})

test('Ninestars Information Technologies Pvt Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Ninestars Information Technologies Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      [
        'Ninestars Information Technologies Pvt Ltd',
        'ninestarsinformationtechnologiespvtltd',
        'Ninestars Information Technologies Pvt Ltd',
      ],
    ],
  )
})

test('Ninestars Information Technologies Pvt Ltd is runnable through the shared scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ninestarsinformationtechnologiespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Ninestars Information Technologies Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ninestarsinformationtechnologiespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://career.ninestarsglobal.com/')
  assert.match(scraper.dryRunFile, /ninestarsinformationtechnologiespvtltd[\\/]jobs\.json$/i)
})

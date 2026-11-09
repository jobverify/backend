import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('BigChillar Technologies Pvt.Ltd is registered as a verified first-party redirect-shell sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bigchillartechnologiespvtltd')

  assert.ok(provider, 'Expected BigChillar Technologies Pvt.Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'BigChillar Technologies Pvt.Ltd')
  assert.equal(provider.companyCareerPage, 'https://bigchillar.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-first-party-route-redirect-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-redirect-shell-plus-parked-lander-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'bigchillar.com')
  assert.match(provider.modulePath, /bigchillartechnologiespvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'BigChillar Technologies Pvt.Ltd'), false)
})

test('BigChillar Technologies Pvt.Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'BigChillar Technologies Pvt.Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BigChillar Technologies Pvt.Ltd', 'bigchillartechnologiespvtltd', 'BigChillar Technologies Pvt.Ltd']],
  )
})

test('BigChillar Technologies Pvt.Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bigchillartechnologiespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the BigChillar Technologies Pvt.Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bigchillartechnologiespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://bigchillar.com/')
  assert.match(scraper.dryRunFile, /bigchillartechnologiespvtltd[\\/]jobs\.json$/i)
})

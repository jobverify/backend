import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Pantheon Digital is registered against the verified first-party and Cutshort hiring handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pantheondigitalpvtltd')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Pantheon Digital Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://cutshort.io/company/pantheon-digital-96-46NMdJSa')
  assert.equal(provider.atsPlatform, 'cutshort')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'validated-single-cutshort-page-and-total-count')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-identity+historical-cutshort-association+exact-company-job-owner+complete-page-check+explicit-india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pantheondigitals.com')
  assert.match(provider.modulePath, /pantheondigitalpvtltd[\\/]script\.js$/i)
})

test('Pantheon Digital Pvt Ltd matches company coverage directly and remains runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Pantheon Digital Pvt Ltd\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pantheon Digital Pvt Ltd', 'pantheondigitalpvtltd', 'Pantheon Digital Pvt Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'pantheondigitalpvtltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'pantheondigitalpvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://cutshort.io/company/pantheon-digital-96-46NMdJSa')
  assert.match(scraper.dryRunFile, /pantheondigitalpvtltd[\\/]jobs\.json$/i)
})

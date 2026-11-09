import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Glowtouch Technology Pvt is registered against the verified first-party GlowTouch careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'glowtouchtechnologypvt')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Glowtouch Technology Pvt')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.glowtouch.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-index-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+india-job-post-links+same-domain-detail-pages+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'glowtouch.com')
  assert.match(provider.modulePath, /glowtouchtechnologypvt[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Glowtouch Technology Pvt exactly', () => {
  const scraper = buildScrapers().find((item) => item.name === 'glowtouchtechnologypvt')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /glowtouchtechnologypvt[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'glowtouchtechnologypvt')

  const report = generateCompanyCoverageReport({
    csvText: 'Glowtouch Technology Pvt,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Glowtouch Technology Pvt', 'glowtouchtechnologypvt', 'Glowtouch Technology Pvt']],
  )
})

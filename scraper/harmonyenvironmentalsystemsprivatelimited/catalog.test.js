import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Harmony Environmental Systems Private Limited is registered as a verified first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find(
    (item) => item.source === 'harmonyenvironmentalsystemsprivatelimited',
  )

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Harmony Environmental Systems Private Limited')
  assert.equal(provider.companyCareerPage, 'https://harmonyenviro.in/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-about-contact-careers-and-career-sitemap-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-contact-page+verified-careers-page+career-sitemap+detail-pages+shared-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'harmonyenviro.in')
  assert.match(provider.modulePath, /harmonyenvironmentalsystemsprivatelimited[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Harmony Environmental Systems Private Limited'),
    false,
  )
})

test('Harmony Environmental Systems Private Limited matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Harmony Environmental Systems Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Harmony Environmental Systems Private Limited',
      'harmonyenvironmentalsystemsprivatelimited',
      'Harmony Environmental Systems Private Limited',
    ]],
  )

  const scraper = buildScrapers().find(
    (item) => item.name === 'harmonyenvironmentalsystemsprivatelimited',
  )

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'harmonyenvironmentalsystemsprivatelimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://harmonyenviro.in/career/')
  assert.match(
    scraper.dryRunFile,
    /harmonyenvironmentalsystemsprivatelimited[\\/]jobs\.json$/i,
  )
})

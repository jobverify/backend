import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Mercer | Mettl is registered as a fail-closed custom script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mercermettl')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-careers-page-linkedin-handoff')
  assert.equal(provider.companyName, 'Mercer | Mettl')
  assert.equal(provider.companyCareerPage, 'https://mercermettl.com/careers/')
  assert.equal(provider.officialSiteUrl, 'https://mercermettl.com/')
  assert.equal(provider.companyDomain, 'mercermettl.com')
  assert.equal(provider.paginationStrategy, 'dual-first-party-careers-pages-plus-homepage-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-mercermettl-careers-pages+linkedin-handoff+same-domain-route-fallback+return-empty',
  )
  assert.equal(provider.verifiedPublicPostingCount, 0)
  assert.match(provider.modulePath, /mercermettl[\\/]script\.js$/i)
})

test('Mercer | Mettl resolves through company coverage for both Mettl names and remains runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nMercer | Mettl\nMettl\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.matched[0]?.source, 'mercermettl')
  assert.equal(report.matched[1]?.source, 'mercermettl')

  const scraper = buildScrapers().find((item) => item.name === 'mercermettl')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mercermettl[\\/]jobs\.json$/i)
})

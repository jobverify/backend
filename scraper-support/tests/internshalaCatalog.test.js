import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Internshala is registered in the provider catalog with the verified careers-page metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'internshala')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-first-party-nextjs-rsc-careers-page')
  assert.equal(provider.companyName, 'Internshala')
  assert.equal(provider.companyCareerPage, 'https://internshala.com/careers/')
  assert.equal(provider.officialSiteUrl, 'https://internshala.com/')
  assert.equal(provider.companyDomain, 'internshala.com')
  assert.equal(provider.paginationStrategy, 'single-nextjs-rsc-careers-page-careercategories-payload')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+rsc-careercategories-payload+first-party-detail-pages+external-notion-fallback',
  )
  assert.equal(provider.verifiedPublicPostingCount, 6)
  assert.match(provider.modulePath, /internshala[\\/]script\.js$/i)
})

test('Internshala resolves through company coverage and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nInternshala\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.matched[0]?.source, 'internshala')

  const scraper = buildScrapers().find((item) => item.name === 'internshala')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /internshala[\\/]jobs\.json$/i)
})

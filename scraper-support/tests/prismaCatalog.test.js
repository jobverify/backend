import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Prisma is registered as a verified first-party zero-open-roles provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'prisma')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Prisma')
  assert.equal(provider.companyCareerPage, 'https://www.prisma.io/careers')
  assert.equal(provider.officialSiteUrl, 'https://www.prisma.io/')
  assert.equal(provider.companyDomain, 'prisma.io')
  assert.equal(provider.atsPlatform, 'first-party-zero-open-roles-page')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+zero-open-roles-marker+return-empty',
  )
  assert.match(provider.modulePath, /prisma[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/)
  assert.match(provider.verifiedSurfaceSummary, /Open roles/i)
  assert.match(provider.verifiedSurfaceSummary, /\b0\b/)
})

test('Prisma resolves through company coverage and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPrisma\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'prisma')

  const scraper = buildScrapers().find((item) => item.name === 'prisma')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /prisma[\\/]jobs\.json$/i)
})

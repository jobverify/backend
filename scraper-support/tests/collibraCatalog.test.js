import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('Collibra registers a verified first-party Greenhouse provider with zero alias dependence', () => {
  const provider = getScraperCatalog().find((entry) => entry.source === 'collibra')

  assert.ok(provider, 'Expected Collibra to be registered in the scraper catalog')
  assert.equal(provider.companyName, 'Collibra')
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.companyCareerPage, 'https://www.collibra.com/company/careers')
  assert.equal(provider.companyDomain, 'collibra.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.template, 'greenhouse')
  assert.equal(provider.templateOptions?.boardToken, 'collibra')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.collibra\.com\/company\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/collibra\/jobs\?content=true/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /zero India openings/i)

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nCollibra\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Collibra', 'collibra', 'Collibra']],
  )
})

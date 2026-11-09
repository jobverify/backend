import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildWorkdayAppliedFacets } from '../myworkday/engine.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'
import { PROVIDER_METADATA as historicalCatalog } from '../../scraper/alteryx.workday/catalog.js'
import { resolveZeroJobOutcome, buildCoverageGapResult } from '../runner.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../utils/scraperOutcome.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Alteryx on the verified first-party careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alteryx')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Alteryx')
  assert.equal(provider.companyCareerPage, 'https://www.alteryx.com/about-us/careers')
  assert.equal(provider.companyDomain, 'alteryx.com')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.baseUrl, /alteryx\.wd108\.myworkdayjobs\.com\/en-US\/AlteryxCareers/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /https:\/\/www\.alteryx\.com\/about-us\/careers/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /alteryx\.wd108\.myworkdayjobs\.com\/en-US\/AlteryxCareers/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /returned 74 total postings/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /c4f78be1a8f14da0ab49ce1162348a5e/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /count 6/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /Sr\. Workday Integration Specialist/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /Learning Programs Specialist/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /CX Operations Specialist/i)
})

test('buildScrapers and company coverage resolve Alteryx from the shared Workday catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alteryx')
  const scraper = buildScrapers().find((item) => item.name === 'alteryx')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(scraper.provider.source, 'alteryx')
  assert.equal(scraper.provider.atsPlatform, 'workday')
  assert.match(scraper.dryRunFile, /alteryx.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nAlteryx\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alteryx', 'alteryx', 'Alteryx']],
  )
})

test('Alteryx local Workday config uses the verified locationCountry facet expected by its public jobs API', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/alteryx.workday'))

  assert.equal(config.countryFacetParameter, 'locationCountry')
  assert.deepEqual(
    buildWorkdayAppliedFacets(
      'https://alteryx.wd108.myworkdayjobs.com/en-US/AlteryxCareers',
      'c4f78be1a8f14da0ab49ce1162348a5e',
      config.countryFacetParameter,
    ),
    {
      locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
    },
  )
})

// July role/count prose remains historical; the effective override is identity-only.
test('Alteryx identity override preserves its native handoff without certifying current inventory', () => {
  const provider = getScraperCatalog().find(item => item.source === 'alteryx')
  const scraper = buildScrapers().find(item => item.name === 'alteryx')
  assert.equal(historicalCatalog.verifiedOn, '2026-07-25')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(provider.baseUrl, 'https://alteryx.wd108.myworkdayjobs.com/en-US/AlteryxCareers')
  assert.equal(provider.companyName, 'Alteryx')
  assert.equal(provider.officialBindingVerifiedAt, '2026-10-20T18:49:24.688Z')
  assert.equal(provider.bindingEvidence.checkedAt, provider.officialBindingVerifiedAt)
  assert.equal(provider.bindingEvidence.officialURL, "https://www.alteryx.com/about-us/careers")
  assert.deepEqual(provider.bindingEvidence.matchedLinks, ["https://alteryx.wd108.myworkdayjobs.com/AlteryxCareers"])
  assert.equal(provider.bindingEvidence.identityScope, "Alteryx employer brand")
  assert.match(provider.verifiedSurfaceSummary, /identity verification is not an inventory or zero-openings claim/i)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.verifiedPublicJobCount ?? null, null)
  assert.equal(provider.verifiedIndiaJobCount ?? null, null)
  assert.equal(provider.verifiedAt ?? null, null)
  const jobs = []
  assert.equal(readInventoryEvidence(jobs), null)
  assert.equal(resolveZeroJobOutcome(scraper, jobs, jobs), 'unverified-zero')
  assert.equal(buildCoverageGapResult(scraper.name, 'unverified-zero').success, false)
  assert.deepEqual(inventoryCleanupOptions({ success: true, zeroJobEvidence: 'unverified-zero', inventoryEvidence: null }), { replaceExisting: false })
  // Synthetic descriptor counters cannot replace native inventory evidence.
  const fabricatedDescriptor = { ...scraper, provider: { ...provider, verifiedPublicJobCount: 0, verifiedIndiaJobCount: 0, verifiedInventoryStatus: 'verified-empty', verifiedAt: provider.officialBindingVerifiedAt } }
  assert.equal(resolveZeroJobOutcome(fabricatedDescriptor, jobs, jobs), 'unverified-zero')
})

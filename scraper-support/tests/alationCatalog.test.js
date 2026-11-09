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
import { PROVIDER_METADATA as historicalCatalog } from '../../scraper/alation.workday/catalog.js'
import { resolveZeroJobOutcome, buildCoverageGapResult } from '../runner.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../utils/scraperOutcome.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const INDIA_FACET_ID = 'c4f78be1a8f14da0ab49ce1162348a5e'

test('getScraperCatalog includes Alation on the verified first-party careers page backed by Workday', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'alation')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Alation')
  assert.equal(provider.officialBrandName, 'Alation')
  assert.equal(provider.companyCareerPage, 'https://www.alation.com/careers/all-careers/')
  assert.equal(provider.companyDomain, 'alation.com')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.baseUrl, /alation\.wd503\.myworkdayjobs\.com\/en-US\/ExternalSite/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /https:\/\/www\.alation\.com\/careers\/all-careers\//i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /alation\.wd503\.myworkdayjobs\.com\/en-US\/ExternalSite/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /People Operations Generalist/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /Software Engineer II/i)
  assert.match(historicalCatalog.verifiedSurfaceSummary, /IND-CHENNAI/i)
})

test('buildScrapers and company coverage resolve Alation from the shared Workday catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alation')
  const scraper = buildScrapers().find((item) => item.name === 'alation')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(scraper.provider.source, 'alation')
  assert.equal(scraper.provider.atsPlatform, 'workday')
  assert.match(scraper.dryRunFile, /alation.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nAlation\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alation', 'alation', 'Alation']],
  )
})

test('Alation local Workday config skips the default India facet and relies on India location filtering', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/alation.workday'))

  assert.equal(config.locationCountry, null)
  assert.match(config.locationPattern, /india|ind-|chennai/i)
  assert.deepEqual(
    buildWorkdayAppliedFacets(
      'https://alation.wd503.myworkdayjobs.com/en-US/ExternalSite',
      config.locationCountry,
      config.countryFacetParameter,
    ),
    {},
  )
})

// July role/count prose remains historical; the effective override is identity-only.
test('Alation identity override preserves its native handoff without certifying current inventory', () => {
  const provider = getScraperCatalog().find(item => item.source === 'alation')
  const scraper = buildScrapers().find(item => item.name === 'alation')
  assert.equal(historicalCatalog.verifiedOn, '2026-07-25')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(provider.baseUrl, 'https://alation.wd503.myworkdayjobs.com/en-US/ExternalSite')
  assert.equal(provider.companyName, 'Alation')
  assert.equal(provider.officialBindingVerifiedAt, '2026-10-20T18:49:24.688Z')
  assert.equal(provider.bindingEvidence.checkedAt, provider.officialBindingVerifiedAt)
  assert.equal(provider.bindingEvidence.officialURL, "https://www.alation.com/careers/all-careers/")
  assert.deepEqual(provider.bindingEvidence.matchedLinks, ["https://alation.wd503.myworkdayjobs.com/ExternalSite/job/IND-CHENNAI/Network-Operations-Center-Engineer-II_R10000801"])
  assert.equal(provider.bindingEvidence.identityScope, "Alation employer brand and the matched Chennai requisition; no separate legal subsidiary asserted")
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

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decorateJobsWithProviderMetadata,
  hydrateProviderCatalogEntry,
  resolveZeroResultPolicy,
} from '../providers/index.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('provider policy classifies placeholder zeros as coverage gaps', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'placeholder-source',
    companyName: 'Placeholder Source',
    adapter: 'script',
    atsPlatform: 'workbook-exact-name-sentinel',
  })

  assert.equal(provider.zeroResultPolicy, 'coverage-gap')
})

test('provider policy requires runtime evidence for normal ATS and company scripts', () => {
  assert.equal(resolveZeroResultPolicy({ adapter: 'workday', atsPlatform: 'workday' }), 'evidence-required')
  assert.equal(resolveZeroResultPolicy({ adapter: 'script', atsPlatform: 'greenhouse' }), 'evidence-required')
})

test('an explicit zero policy overrides inferred metadata', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'migrated-source',
    companyName: 'Migrated Source',
    adapter: 'script',
    atsPlatform: 'workbook-exact-name-sentinel',
    zeroResultPolicy: 'evidence-required',
  })

  assert.equal(provider.zeroResultPolicy, 'evidence-required')
})

test('provider adapters preserve non-enumerable inventory evidence while decorating jobs', async () => {
  const jobs = attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: 'https://example.test/jobs',
    firstParty: false,
    listingComplete: true,
    pagesFetched: 1,
    reportedTotal: 0,
    indiaFacetCount: 0,
    verifiedAt: '2026-09-13T00:00:00.000Z',
    reason: 'test-directory-evidence',
  })
  const decoratedJobs = decorateJobsWithProviderMetadata(jobs, {
    source: 'test-source',
    companyName: 'Test Source',
    countryFilter: 'India',
    companyCareerPage: 'https://example.test/jobs',
    companyDomain: 'example.test',
    atsPlatform: 'directory',
  })

  assert.equal(readInventoryEvidence(decoratedJobs)?.status, 'discovery-only')
})

test('verified no-public-careers snapshots attach discovery-only zero evidence', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'consumer-shell-source',
    companyName: 'Consumer Shell Source',
    adapter: 'script',
    companyCareerPage: 'https://example.test/careers',
    companyDomain: 'example.test',
    atsPlatform: 'official-company-site-no-public-careers',
    extractionStrategy: 'verified-consumer-marketing-shell-return-empty',
    verifiedOn: '2026-09-14',
    verifiedPublicJobCount: 0,
    verifiedIndiaJobCount: 0,
  })

  const decoratedJobs = decorateJobsWithProviderMetadata([], provider)
  const inventoryEvidence = readInventoryEvidence(decoratedJobs)

  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(inventoryEvidence?.status, 'discovery-only')
  assert.equal(inventoryEvidence?.listingComplete, false)
  assert.equal(inventoryEvidence?.reportedTotal, 0)
})

test('legacy verified fail-closed snapshots without explicit counts attach discovery-only evidence', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'legacy-form-only-source',
    companyName: 'Legacy Form Only Source',
    adapter: 'script',
    companyCareerPage: 'https://example.test/careers',
    atsPlatform: 'first-party-careers-page-generic-application-form',
    extractionStrategy: 'verified-first-party-careers-page+generic-application-form-without-public-openings+fail-closed-sentinel',
    verifiedOn: '2026-09-14',
    verifiedSurfaceSummary:
      'Verified first-party careers page exposes only a generic application form without public openings.',
  })

  const decoratedJobs = decorateJobsWithProviderMetadata([], provider)
  const inventoryEvidence = readInventoryEvidence(decoratedJobs)

  assert.equal(inventoryEvidence?.status, 'discovery-only')
  assert.equal(inventoryEvidence?.reason, provider.verifiedSurfaceSummary)
})

test('exact-name workbook sentinels without a verified URL attach discovery-only evidence', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'legacy-exact-name-source',
    companyName: 'Legacy Exact Name Source',
    adapter: 'script',
    atsPlatform: 'workbook-exact-name-sentinel',
    extractionStrategy:
      'exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified',
    verifiedOn: '2026-07-29',
    verifiedPublicJobCount: 0,
    verifiedIndiaJobCount: 0,
    verifiedSurfaceSummary:
      'Workbook exact-name sentinel intentionally returns zero jobs until a trustworthy public careers surface is verified.',
  })

  const decoratedJobs = decorateJobsWithProviderMetadata([], provider)
  const inventoryEvidence = readInventoryEvidence(decoratedJobs)

  assert.equal(provider.zeroResultPolicy, 'coverage-gap')
  assert.equal(inventoryEvidence?.status, 'discovery-only')
  assert.equal(inventoryEvidence?.surface, null)
  assert.equal(inventoryEvidence?.listingComplete, false)
  assert.equal(inventoryEvidence?.reason, provider.verifiedSurfaceSummary)
})

test('legacy exact-name sentinels with only a verified summary still attach discovery-only evidence', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'legacy-summary-only-source',
    companyName: 'Legacy Summary Only Source',
    adapter: 'script',
    atsPlatform: 'workbook-exact-name-sentinel',
    backfillMode: 'sentinel',
    extractionStrategy:
      'exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified',
    verifiedPublicJobCount: 0,
    verifiedIndiaJobCount: 0,
    verifiedSurfaceSummary:
      'Workbook batch 02 exact-name sentinel added on Saturday, July 25, 2026. It intentionally returns zero jobs until a trustworthy public careers surface is verified.',
  })

  const decoratedJobs = decorateJobsWithProviderMetadata([], provider)
  const inventoryEvidence = readInventoryEvidence(decoratedJobs)

  assert.equal(provider.zeroResultPolicy, 'coverage-gap')
  assert.equal(inventoryEvidence?.status, 'discovery-only')
  assert.equal(inventoryEvidence?.verifiedAt, null)
  assert.equal(inventoryEvidence?.reason, provider.verifiedSurfaceSummary)
})

test('legacy discovery-only inference does not override explicit positive counts', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'positive-count-source',
    companyName: 'Positive Count Source',
    adapter: 'script',
    companyCareerPage: 'https://example.test/careers',
    atsPlatform: 'official-careers-blocked-by-cloudflare',
    extractionStrategy: 'verified-search-page+cloudflare-blocked+fail-closed-sentinel',
    verifiedOn: '2026-09-14',
    verifiedPublicJobCount: 12,
    verifiedIndiaJobCount: 2,
  })

  const decoratedJobs = decorateJobsWithProviderMetadata([], provider)

  assert.equal(readInventoryEvidence(decoratedJobs), null)
})

test('verified zero public count is sufficient for discovery-only India zero evidence', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'zero-public-source',
    companyName: 'Zero Public Source',
    adapter: 'script',
    companyCareerPage: 'https://example.test/careers',
    atsPlatform: 'official-first-party-jobs-page-non-enumerable-sentinel',
    extractionStrategy: 'verified-first-party-jobs-page+filters-without-trustworthy-public-enumeration+return-empty',
    verifiedOn: '2026-09-14',
    verifiedPublicJobCount: 0,
  })

  const decoratedJobs = decorateJobsWithProviderMetadata([], provider)
  const inventoryEvidence = readInventoryEvidence(decoratedJobs)

  assert.equal(inventoryEvidence?.status, 'discovery-only')
  assert.equal(inventoryEvidence?.indiaFacetCount, 0)
})

test('historical zero India catalog notes cannot substitute for fetched inventory', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'global-openings-zero-india',
    companyName: 'Global Openings Zero India',
    adapter: 'script',
    companyCareerPage: 'https://example.test/careers',
    atsPlatform: 'official-ats-careers',
    extractionStrategy: 'verified-official-ats-without-enumerable-india-listings+return-empty',
    verifiedOn: '2026-09-14',
    verifiedPublicJobCount: 9,
    verifiedIndiaJobCount: 0,
    verifiedSurfaceSummary: 'Verified public board lists nine global openings and no India openings.',
  })

  const decoratedJobs = decorateJobsWithProviderMetadata([], provider)
  const inventoryEvidence = readInventoryEvidence(decoratedJobs)

  assert.equal(inventoryEvidence?.status, 'unverified')
  assert.equal(inventoryEvidence?.reportedTotal, null)
  assert.equal(inventoryEvidence?.indiaFacetCount, null)
})

test('complete-inventory zero-India inference does not override positive India counts', () => {
  const provider = hydrateProviderCatalogEntry({
    source: 'global-openings-positive-india',
    companyName: 'Global Openings Positive India',
    adapter: 'script',
    companyCareerPage: 'https://example.test/careers',
    atsPlatform: 'official-ats-careers',
    extractionStrategy: 'verified-official-ats-without-stable-public-feed+return-empty',
    verifiedOn: '2026-09-14',
    verifiedPublicJobCount: 12,
    verifiedIndiaJobCount: 2,
  })

  const decoratedJobs = decorateJobsWithProviderMetadata([], provider)

  assert.equal(readInventoryEvidence(decoratedJobs), null)
})

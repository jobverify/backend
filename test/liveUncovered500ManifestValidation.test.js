import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  LIVE_UNCOVERED_500_MANIFEST_NAME,
  LIVE_UNCOVERED_500_VERIFIED_ON,
  loadLiveUncovered500Manifest,
  runLiveUncovered500ManifestValidation,
  validateLiveUncovered500Manifest,
} from '../scripts/validateLiveUncovered500Manifest.js'

const createEntry = (overrides = {}) => ({
  companyName: 'Alpha Labs',
  normalizedCompanyName: 'alpha',
  companyDomain: 'alpha.example',
  officialCareersUrl: 'https://alpha.example/careers',
  officialJobsListingUrl: 'https://alpha.example/jobs',
  sampleLiveJobTitle: 'Software Engineer',
  sampleLiveJobUrl: 'https://alpha.example/jobs/1',
  sampleLiveJobLocation: 'Bengaluru, India',
  indiaHiringEvidence: 'Official listing shows Bengaluru, India.',
  verifiedOn: LIVE_UNCOVERED_500_VERIFIED_ON,
  verificationNotes: 'Public job detail page loaded without login.',
  discoverySource: 'official careers page',
  ...overrides,
})

const createManifest = (companies) => ({
  manifestVersion: 1,
  manifestName: LIVE_UNCOVERED_500_MANIFEST_NAME,
  verifiedOn: LIVE_UNCOVERED_500_VERIFIED_ON,
  companies,
})

test('validateLiveUncovered500Manifest accepts a clean uncovered synthetic manifest', () => {
  const manifest = createManifest([
    createEntry(),
    createEntry({
      companyName: 'Beta Systems',
      normalizedCompanyName: 'beta',
      companyDomain: 'beta.example',
      officialCareersUrl: 'https://beta.example/careers',
      officialJobsListingUrl: 'https://beta.example/jobs',
      sampleLiveJobTitle: 'Backend Engineer',
      sampleLiveJobUrl: 'https://beta.example/jobs/2',
      sampleLiveJobLocation: 'Pune, India',
      indiaHiringEvidence: 'Official listing shows Pune, India.',
    }),
  ])

  const result = validateLiveUncovered500Manifest({
    manifest,
    catalog: [],
    aliasMap: {},
    expectedCount: 2,
  })

  assert.deepEqual(result.errors, [])
  assert.equal(result.summary.totalCompanies, 2)
  assert.deepEqual(result.summary.coveredCompanies, [])
  assert.deepEqual(result.summary.invalidNormalizedNames, [])
  assert.deepEqual(result.summary.duplicateCareersUrls, [])
  assert.deepEqual(result.summary.duplicateJobUrls, [])
  assert.deepEqual(result.summary.missingRequiredFields, [])
  assert.deepEqual(result.summary.invalidUrlFields, [])
})

test('validateLiveUncovered500Manifest rejects covered companies, duplicate URLs, bad normalized names, and missing fields', () => {
  const manifest = createManifest([
    createEntry(),
    createEntry({
      companyName: 'Amazon',
      normalizedCompanyName: 'wrong value',
      companyDomain: 'amazon.jobs',
      officialCareersUrl: 'notaurl',
      officialJobsListingUrl: 'https://www.amazon.jobs/en/locations/india',
      sampleLiveJobTitle: '',
      sampleLiveJobUrl: 'https://alpha.example/jobs/1',
      sampleLiveJobLocation: 'Hyderabad, India',
      indiaHiringEvidence: 'Official location page lists India openings.',
    }),
  ])

  const result = validateLiveUncovered500Manifest({
    manifest,
    catalog: [{ source: 'amazon', companyName: 'Amazon' }],
    aliasMap: {},
    expectedCount: 2,
  })

  assert.equal(result.errors.length > 0, true)
  assert.deepEqual(result.summary.coveredCompanies, ['Amazon'])
  assert.deepEqual(result.summary.invalidNormalizedNames, ['Amazon'])
  assert.deepEqual(result.summary.duplicateJobUrls, ['https://alpha.example/jobs/1'])
  assert.deepEqual(result.summary.invalidUrlFields, ['Amazon:officialCareersUrl'])
  assert.deepEqual(result.summary.missingRequiredFields, ['Amazon:sampleLiveJobTitle'])
})

test('runLiveUncovered500ManifestValidation loads a manifest path and returns a clean summary', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-live-uncovered-500-'))
  const manifestPath = path.join(tempDir, 'manifest.json')

  writeFileSync(
    manifestPath,
    `${JSON.stringify(createManifest([createEntry()]), null, 2)}\n`,
  )

  assert.deepEqual(loadLiveUncovered500Manifest({ manifestPath }), createManifest([createEntry()]))

  const summary = runLiveUncovered500ManifestValidation({
    manifestPath,
    catalog: [],
    aliasMap: {},
    expectedCount: 1,
  })

  assert.equal(summary.totalCompanies, 1)
  assert.deepEqual(summary.coveredCompanies, [])
})

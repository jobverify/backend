import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog, decorateJobsWithProviderMetadata } from '../providers/index.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../utils/inventoryEvidence.js'

test('explicit repair overrides cannot be replaced by an older base API portal configuration', () => {
  const catalog = getScraperCatalog({ providerExtensions: [{ source: 'gitlab', companyName: 'GitLab',
    adapter: 'script', modulePath: '../gitlab/script.js', catalogOverride: true,
    atsPlatform: 'greenhouse', boardToken: 'gitlab', zeroResultPolicy: 'evidence-required',
  }] })
  const repaired = catalog.find(provider => provider.source === 'gitlab')
  assert.equal(repaired.adapter, 'script')
  assert.equal(repaired.boardToken, 'gitlab')
})

test('same-day catalog notes cannot manufacture verified empty live inventory', () => {
  const jobs = decorateJobsWithProviderMetadata([], { source: 'example', companyCareerPage: 'https://example.com/jobs',
    backfillMode: 'verified-empty-state', verifiedPublicJobCount: 0, verifiedIndiaJobCount: 0, verifiedOn: new Date().toISOString() })
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), false)
  assert.equal(readInventoryEvidence(jobs).status, 'unverified')
})

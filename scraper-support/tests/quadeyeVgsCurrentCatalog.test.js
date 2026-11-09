import assert from 'node:assert/strict'
import test from 'node:test'
import { decorateJobsWithProviderMetadata, getScraperCatalog } from '../providers/index.js'
import { isFreshCompleteInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'
import quadeye from '../../scraper/quadeye/catalog.js'
import vgs from '../../scraper/verygoodsecurityindia/catalog.js'

const catalog = getScraperCatalog()

test('QuadEye and VGS effective catalogs preserve current local routing and extraction contracts', () => {
  for (const local of [quadeye, vgs]) {
    const effective = catalog.find(provider => provider.source === local.source)
    assert.ok(effective, local.source)
    for (const key of ['companyName', 'adapter', 'modulePath', 'companyCareerPage', 'atsPlatform', 'countryFilter', 'paginationStrategy', 'extractionStrategy']) {
      assert.equal(effective[key], local[key], local.source + ' ' + key)
    }
  }
})

test('VGS retains discovery-only scope with unknown inventory counts', () => {
  const effective = catalog.find(provider => provider.source === vgs.source)
  assert.equal(effective.verifiedOn, null)
  assert.equal(effective.verifiedInventoryStatus, 'unverified')
  assert.equal(effective.verifiedPublicJobCount, null)
  assert.equal(effective.verifiedIndiaJobCount, null)
  assert.equal(effective.sourceScopeComplete, false)
  assert.equal(effective.lifecycleCleanupAllowed, false)
  assert.equal(effective.zeroResultPolicy, 'coverage-gap')
})

test('QuadEye and VGS historical catalog snapshots cannot establish fresh complete inventory', () => {
  for (const local of [quadeye, vgs]) {
    const effective = catalog.find(provider => provider.source === local.source)
    const jobs = decorateJobsWithProviderMetadata([], effective)
    assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), false, local.source)
  }
})

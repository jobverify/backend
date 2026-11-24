import test from 'node:test'
import assert from 'node:assert/strict'
import {createBitwiseSolutionsScraper,PROVIDER_METADATA,VERIFIED_ON} from './script.js'
import {BITWISE_SOLUTIONS_CATALOG} from './catalog.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {networkFences,replay} from './fixtures/currentReplay20261121.js'

test('public source metadata describes current partial acquisition without a stale zero attestation',()=>{
 assert.equal(PROVIDER_METADATA,BITWISE_SOLUTIONS_CATALOG)
 assert.equal(PROVIDER_METADATA.source,'bitwisesolutions');assert.equal(PROVIDER_METADATA.companyName,'Bitwise Solutions');assert.equal(PROVIDER_METADATA.officialBrandName,'Bitwise')
 assert.equal(VERIFIED_ON,null);assert.equal(PROVIDER_METADATA.sourceTimeoutMs,180000);assert.equal(PROVIDER_METADATA.parser,'custom-script')
 assert.equal(PROVIDER_METADATA.atsPlatform,'first-party-current-publication');assert.ok(!/July 18|No openings found/.test(PROVIDER_METADATA.verifiedSurfaceSummary))
})
test('explicit caller zero cap precedes the historical body-only observation path',async t=>{
 const restore=networkFences();t.after(restore);const transport=replay()
 const jobs=await createBitwiseSolutionsScraper().run({fetchText:transport.fetchText,maxJobs:0})
 assert.equal(jobs.length,0);assert.equal(transport.legacyTextCalls.length,0);assert.equal(transport.calls.length,0)
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.pagesFetched,0);assert.equal(inventory.firstParty,false);assert.equal(inventory.listingComplete,false);assert.equal(inventory.verifiedAt,null);assert.equal(inventory.lifecycleCleanupAllowed,false)
})

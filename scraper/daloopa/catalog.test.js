import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,loadProviderExtensions,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {createDaloopaReplay,withDaloopaReplayClock,assertDaloopaCurrentJobs} from './fixtures/replayNativeData20261115.js'

test('actual current Daloopa registration selects the source-local native data collector',()=>{
 const provider=getScraperCatalog().find(row=>row.source==='daloopa')
 assert(provider.modulePath.replaceAll('\\','/').endsWith('/daloopa/nativeData20261115.js'))
 assert.equal(provider.source,'daloopa');assert.equal(provider.companyName,'Daloopa');assert.equal(provider.countryFilter,'India')
})
test('same loaded extension list changes only Daloopa and preserves every other catalog object and order',()=>{
 const loaded=loadProviderExtensions(),selected=loaded.filter(row=>row.source==='daloopa'&&row.modulePath==='../daloopa/nativeData20261115.js');assert.equal(selected.length,1)
 const current=getScraperCatalog({providerExtensions:loaded}),before=getScraperCatalog({providerExtensions:loaded.filter(row=>row!==selected[0])})
 assert.equal(current.length,before.length);assert.ok(current.length>0);assert.deepEqual(current.map(row=>row.source),before.map(row=>row.source));assert.deepEqual(current.filter(row=>row.source!=='daloopa'),before.filter(row=>row.source!=='daloopa'))
})
test('actual default registered route uses14original reads with null actions/publication and all scope holds',async()=>{
 const io=createDaloopaReplay(),provider=getScraperCatalog().find(row=>row.source==='daloopa')
 const jobs=await withDaloopaReplayClock(()=>{globalThis.fetch=io.fetchImpl;return createCatalogScraper(provider).run({})})
 assertDaloopaCurrentJobs(jobs,io.fixture);assert.equal(io.calls.length,14)
})
test('poisoned explicit generic recovery cannot add reads after first native carrier failure',async()=>{
 const io=createDaloopaReplay(()=>Buffer.from('Unreviewed static carrier')),provider=getScraperCatalog().find(row=>row.source==='daloopa');let fallbackCalls=0
 const poison=()=>{fallbackCalls++;throw Error('Unexpected generic fallback')}
 await withDaloopaReplayClock(()=>{globalThis.fetch=io.fetchImpl;return assert.rejects(createCatalogScraper(provider).run({softFailureRecovery:{fetchImpl:poison},emptyOnlyRecovery:{fetchImpl:poison}}),error=>error.code==='DALOOPA_NATIVE_DATA_GAP'&&error.lifecycleCleanupAllowed===false)})
 assert.equal(io.calls.length,1);assert.equal(fallbackCalls,0)
})

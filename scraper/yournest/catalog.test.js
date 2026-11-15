import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,loadProviderExtensions,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {createYourNestReplay,withYourNestReplayClock,assertYourNestCurrentJobs} from './fixtures/replayNativeData20261115.js'

test('YourNest actual registered native entry preserves identity, India and all company/cleanup holds',()=>{
 const provider=getScraperCatalog().find(row=>row.source==='yournest')
 assert(provider.modulePath.endsWith('yournest/nativeData20261115.js')||provider.modulePath.endsWith('yournest\\nativeData20261115.js'))
 assert.equal(provider.companyName,'YourNest');assert.equal(provider.countryFilter,'India');assert.equal(provider.parser,'custom-script')
 assert.equal(provider.atsPlatform,'pyjamahr-native-anonymous-api');assert.equal(provider.firstParty,false)
 assert.equal(provider.sourceCorporateBindingQualified,false);assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false)
 assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null)
})
test('same-list catalog counterfactual changes only YourNest and preserves all other4565 objects/order',()=>{
 const loaded=loadProviderExtensions(),selected=loaded.filter(row=>row.source==='yournest'&&row.modulePath==='../yournest/nativeData20261115.js')
 assert.equal(selected.length,1)
 const current=getScraperCatalog({providerExtensions:loaded}),before=getScraperCatalog({providerExtensions:loaded.filter(row=>row!==selected[0])})
 assert.equal(current.length,4566);assert.deepEqual(current.map(row=>row.source),before.map(row=>row.source))
 assert.deepEqual(current.filter(row=>row.source!=='yournest'),before.filter(row=>row.source!=='yournest'))
})
test('actual registered default transport returns only the full native internship in20reads',async()=>{
 const io=createYourNestReplay(),provider=getScraperCatalog().find(row=>row.source==='yournest')
 const jobs=await withYourNestReplayClock(()=>{globalThis.fetch=io.fetchImpl;return createCatalogScraper(provider).run({})})
 assertYourNestCurrentJobs(jobs,io.fixture);assert.equal(io.calls.length,20)
})
test('registered default native failure cannot invoke extra generic script recovery reads',async()=>{
 const io=createYourNestReplay(()=>Buffer.from('Changed original board')),provider=getScraperCatalog().find(row=>row.source==='yournest')
 await withYourNestReplayClock(()=>{globalThis.fetch=io.fetchImpl;return assert.rejects(createCatalogScraper(provider).run({}),error=>error.code==='YOURNEST_COVERAGE_GAP'&&error.lifecycleCleanupAllowed===false)})
 assert.equal(io.calls.length,1)
})

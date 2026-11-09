import assert from'node:assert/strict'
import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import test from'node:test'
import{createApolloTyresScraper,run}from'./script.js'
import{readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
const{captures}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const native=key=>Buffer.from(captures.find(row=>row.key===key).body,'base64').toString(),payload=()=>JSON.parse(native('production-1'))
const replay=mutate=>{const counts=new Map(),calls=[];return{calls,fetchText:async(url,options)=>{calls.push(url);const key=url==='https://corporate.apollotyres.com/careers/'?'corporate':url.endsWith('/home.controls.js')?'controls-client':'production-0',count=(counts.get(key)||0)+1;counts.set(key,count);return mutate?.(key,count,native(key),options)??native(key)},fetchJson:async(url,options)=>{calls.push(url);assert.equal(url,'https://uk.api.csod.com/rec-job-search/external/jobs');const body=JSON.parse(options.body);assert.equal(body.countryCodes,'');assert.equal(body.searchText,'');assert.equal(body.postingsWithinDays,0);assert.deepEqual(body.customFieldCheckboxKeys,[]);const count=(counts.get('api')||0)+1;counts.set('api',count);return mutate?.('api',count,payload(),options)??payload()}}}
test('actual current corporate handoff and anonymous unfiltered CSOD zero reconcile opening and closing',async()=>{
 const options=replay();let audit;const jobs=await createApolloTyresScraper().run({...options,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs)?.status,'verified-empty');assert.equal(readInventoryEvidence(jobs).reportedTotal,0);assert.equal(audit.closingInventoryMatches,true);assert.equal(audit.sourceCompanyWideScopeComplete,false);assert.equal(options.calls.length,8)
})
test('production run forwards the injected native reads and audit callback',async()=>{let audit;const jobs=await run({...replay(),onAudit:value=>{audit=value}});assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(audit.observedListingCount,0)})
test('unknown API data cannot be converted to an empty inventory by a totalCount fallback',async()=>{
 await assert.rejects(createApolloTyresScraper().run(replay((key,_n,value)=>key==='api'?{status:'Failure',data:{}}:value)),/native|CSOD|inventory/i)
})
test('missing active corporate handoff or different anonymous tenant cannot establish this employer',async()=>{
 for(const kind of['corporate','tenant'])await assert.rejects(createApolloTyresScraper().run(replay((key,_n,value)=>kind==='corporate'&&key==='corporate'?'<title>Careers | Apollo Tyres Corporate</title><template>'+value+'</template>':kind==='tenant'&&key==='production-0'?value.replace('"corp":"apollotyres"','"corp":"other-employer"'):value)),/identity|handoff|tenant|context/i)
})
test('contradictory total and IDs fail rather than invent an empty native inventory',async()=>{
 await assert.rejects(createApolloTyresScraper().run(replay((key,_n,value)=>key==='api'?{...value,data:{...value.data,requisitions:[{requisitionId:1}]}}:value)),/inventory|total|count/i)
})
test('a changed closing zero or future positive native payload is held for full criteria and country qualification',async()=>{
 for(const closingOnly of[true,false]){const jobs=await createApolloTyresScraper().run(replay((key,count,value)=>key==='api'&&(!closingOnly||count===2)?{...value,data:{...value.data,totalCount:1,requisitions:[{requisitionId:1,displayJobTitle:'Engineer'}]}}:value));assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')}
})
test('native endpoint changes cannot redirect the anonymous bearer to another origin',async()=>{
 const options=replay((key,_n,value)=>key==='production-0'?value.replace('"cloud":"https://uk.api.csod.com/"','"cloud":"https://example.org/"'):value)
 await assert.rejects(createApolloTyresScraper().run(options),/endpoint|context|tenant/i);assert.ok(!options.calls.some(url=>url.startsWith('https://example.org')))
})
test('bounded native read and observer honor caller cancellation',async()=>{
 await assert.rejects(createApolloTyresScraper().run({fetchText:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(createApolloTyresScraper().run({...replay(),onAudit:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(createApolloTyresScraper().run({...replay(),signal:AbortSignal.abort(Error('stop Apollo'))}),/stop Apollo/)
})

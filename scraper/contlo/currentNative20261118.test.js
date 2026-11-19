import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261118.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
function replay(edit=(p,s)=>s){const calls=[],counts=new Map();return{calls,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
 const p=fixture.responses.find(p=>p.url===url);assert.ok(p,url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');calls.push(url);const count=(counts.get(url)||0)+1;counts.set(url,count)
 return Object.defineProperty(new Response(edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count),{status:p.status,headers:p.headers}),'url',{value:p.url})
}}}}
test('current coherent Contlo corporate deployment retains its full explicit India role with closing models and scope holds',async()=>{
 const{calls,options}=replay(),jobs=await run(options);assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].jobId,'10bfc88c061c2a93c7ea9098');assert.match(jobs[0].jobDescription,/1 to 3 years/)
 assert.equal(calls.length,16);assert.equal(jobs.nativeCollectionEvidence.closingFullNativeModelsMatch,true);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('current Contlo still rejects unseen corporate code and mixed declared deployments',async()=>{
 const extra=replay((p,s)=>p.url==='https://contlo.com/'?s.replace('</body>','<script>window.extraHiringRules=true</script></body>'):s)
 await assert.rejects(run(extra.options),/whole finite current corporate deployment/)
 const mixed=replay((p,s)=>p.url==='https://contlo.com/careers'?Buffer.from(historical.responses.find(row=>row.url==='https://contlo.com/careers').bodyBase64,'base64').toString():s)
 await assert.rejects(run(mixed.options),/whole finite current corporate deployment/)
})
test('current Contlo native tenant and complete criteria guards remain active',async()=>{
 const tenant=replay((p,s)=>p.url.endsWith('/api/embed/contlo')?s.replace('"workspace":"contlo"','"workspace":"other"'):s)
 await assert.rejects(run(tenant.options),/native full inventory/)
 const criteria=replay((p,s)=>p.url.includes('/apply/10bfc')?s.replace('1 to 3 years','7 to 8 years'):s)
 await assert.rejects(run(criteria.options),/changed at closing|native|hydration/)
})

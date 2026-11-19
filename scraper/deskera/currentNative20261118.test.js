import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261118.json.gz',import.meta.url))))
function replay(edit=(p,s)=>s){const counts=new Map(),calls=[];return{calls,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{calls.push(url);const matches=fixture.responses.filter(p=>p.url===url),count=counts.get(url)||0,p=matches[Math.min(count,matches.length-1)];counts.set(url,count+1);assert.ok(p,url);assert.equal(init.method,'GET');return Object.defineProperty(new Response(edit(p,Buffer.from(p.bodyBase64,'base64').toString()),{status:p.status,headers:p.headers}),'url',{value:p.url})}}}}
test('current Deskera exact regional handoff still exposes unqualified other-employer keyword candidates',async()=>{
 const{calls,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const a=e.nativeCollectionEvidence;assert.equal(a.sourceEmployerBindingsProven,false);assert.equal(a.companyIndiaTotal,null);assert.equal(a.lifecycleCleanupAllowed,false);assert.ok(a.unqualifiedNativeCandidates.length>0);assert.ok(a.unqualifiedNativeCandidates.every(c=>c.sourceEmployerBound===false));return true});assert.equal(calls.length,5)
})
test('current Deskera foreign Careers target cannot qualify recruitment authority',async()=>{
 const{options}=replay((p,s)=>p.url==='https://www.deskera.com/in'?s.replaceAll('https://www.linkedin.com/jobs/deskera-jobs','https://foreign.example/jobs'):s)
 await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error')
})

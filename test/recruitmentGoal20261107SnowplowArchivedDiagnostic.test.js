import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {diagnoseArchivedSnowplow} from '../scraper/snowplow/currentNative.js'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/snowplow/test-data/current-native-20261106-evening.json.gz',import.meta.url)))).packets

test('Snowplow archived diagnostic retains all eleven original full models without live qualification',async()=>{
 const before=JSON.stringify(original),result=await diagnoseArchivedSnowplow(original)
 assert.equal(result.diagnosticOnly,true);assert.equal(result.publicRequests,0);assert.equal(result.observedNativeRows,11)
 assert.deepEqual(result.audit.canonicalCountryCounts,{US:6,GB:5});assert.equal(result.audit.detailProofs.filter(p=>p.rawOpening&&p.rawClosing).length,11)
 assert.equal(result.evidence.firstParty,false);assert.equal(result.evidence.listingComplete,false);assert.equal(result.evidence.reportedTotal,null);assert.equal(result.evidence.indiaFacetCount,null);assert.equal(result.evidence.verifiedAt,null)
 assert.equal(result.audit.sourceScopeComplete,false);assert.equal(JSON.stringify(original),before)
 assert.ok(result.requests.filter(p=>p.url.includes('/api/')).every(p=>p.init.headers.companyIdentifier==='snowplow'))
})
test('Snowplow archived diagnostic rejects accessor input without invoking publisher code',async()=>{
 let reads=0;const first={...original[0]};Object.defineProperty(first,'body',{get(){reads++;return original[0].body}})
 await assert.rejects(diagnoseArchivedSnowplow([first,...original.slice(1)]),/data-only|accessor/i);assert.equal(reads,0)
})
test('Snowplow archived diagnostic rejects callable input without a transport callback',async()=>{
 let reads=0;const first={...original[0],fetchPage(){reads++;throw Error('No transport in data-only diagnostics')}}
 await assert.rejects(diagnoseArchivedSnowplow([first,...original.slice(1)]),/data-only|callable/i);assert.equal(reads,0)
})

for(const key of ['contentType','url','status'])test('Snowplow archived diagnostic never coerces object-valued '+key,async()=>{
 let calls=0;const value={toString(){calls++;return String(original[0][key])},[Symbol.toPrimitive](){calls++;return original[0][key]}}
 await assert.rejects(diagnoseArchivedSnowplow([{...original[0],[key]:value},...original.slice(1)]));assert.equal(calls,0)
})
for(const target of ['packet','array'])test('Snowplow archived diagnostic rejects '+target+' proxies before invoking traps',async()=>{
 let calls=0;const handler={get(object,key,receiver){calls++;return Reflect.get(object,key,receiver)},ownKeys(object){calls++;return Reflect.ownKeys(object)},getOwnPropertyDescriptor(object,key){calls++;return Reflect.getOwnPropertyDescriptor(object,key)}}
 const packets=target==='packet'?[new Proxy({...original[0]},handler),...original.slice(1)]:new Proxy(original,handler)
 await assert.rejects(diagnoseArchivedSnowplow(packets));assert.equal(calls,0)
})

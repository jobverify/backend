import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
const ROOT='https://digiledge.in/',HOME='https://www.digiledge.in/en',CAREERS=HOME+'/careers'
function replay(change=()=>{}){
 const calls=[],seen=new Map()
 const fetchImpl=async(url,init)=>{
  assert.equal(init.method??'GET','GET')
  const o=originals.find(r=>new URL(r.requestedUrl).href===url);assert.ok(o,'Undeclared native request '+url)
  const nth=(seen.get(url)||0)+1;seen.set(url,nth);calls.push(url)
  const r={...structuredClone(o),body:Buffer.from(o.bodyBase64,'base64').toString()};change(r,url,nth)
  const response=new Response(r.body,{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response
 }
 return {fetchImpl,calls}
}
test('current declared redirect chain and complete empty careers block are bounded observations, never company zero proof',async t=>{
 const transport=replay();t.mock.method(globalThis,'fetch',transport.fetchImpl)
 const jobs=await run({fetchImpl:transport.fetchImpl,now:'2026-11-17T00:00:00Z'})
 assert.deepEqual(jobs,[])
 assert.deepEqual(readSourceObservationEvidence(jobs,'digiledge'),{source:'digiledge',recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const e=jobs.nativeCollectionEvidence;assert.equal(e.wholeObservedNativeBoardClosingReconciled,true);assert.equal(e.companyIndiaZeroProven,false)
 assert.equal(e.originalResponses.length,14);assert.deepEqual(e.nativeOpeningAuthority.nativeOpenPositions.jobs,[])
 assert.deepEqual(e.nativeOpeningAuthority,e.nativeClosingAuthority);assert.equal(e.applicationInteractions,0)
 assert.equal(transport.calls.filter(url=>url===CAREERS).length,2)
})
test('an employer redirect cannot be followed to an unreviewed authority',async()=>{
 const {fetchImpl,calls}=replay((r,url)=>{if(url===ROOT)r.headers.location='https://other-employer.example/careers'})
 await assert.rejects(run({fetchImpl}),/redirect.*(authority|changed)|declared.*redirect/i)
 assert.deepEqual(calls,[ROOT])
})
test('whole current careers input and critical renderer must match their finite reviewed profiles',async()=>{
 for(const target of [CAREERS,'https://www.digiledge.in/_next/static/chunks/app/%5Blocale%5D/careers/page-773f9de1389ff397.js']){
  const {fetchImpl}=replay((r,url)=>{if(url===target)r.body+='\n<!-- unknown criteria -->'})
  await assert.rejects(run({fetchImpl}),/whole.*(HTML|client)|reviewed.*(HTML|client)|renderer/i)
 }
})
test('closing whole native block/criteria changes cannot certify even an observed zero',async()=>{
 const {fetchImpl}=replay((r,url,nth)=>{if(url===CAREERS&&nth===2)r.body=r.body.replace('Join the Digiledge Tribe','Other employer roles')})
 await assert.rejects(run({fetchImpl}),/whole.*HTML|reviewed.*HTML|identity|opening.*closing/i)
})
test('a native challenge preserves its HTTP status and never becomes observed empty',async()=>{
 const {fetchImpl}=replay((r,url)=>{if(url===CAREERS){r.status=403;r.body='<html>Just a moment...</html>'}})
 await assert.rejects(run({fetchImpl}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied'&&error.lifecycleCleanupAllowed===false)
})
test('body-only responses cannot prove a native redirect chain',async()=>{
 await assert.rejects(run({fetchText:async()=>'<html>Digiledge /careers</html>'}),/original.*metadata|body-only/i)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
const HOME='https://www.logic-fruit.com/',MAIN=HOME+'assets/index-CAHOli87.js',LIST='https://api.logic-fruit.com/api/jobs?status=published'
const listing=JSON.parse(Buffer.from(captures.find(r=>r.requestedUrl===LIST).bodyBase64,'base64'))
const detail='https://api.logic-fruit.com/api/jobs/'+listing.data[0].slug
function replay(change=()=>{}){
 const calls=[],seen=new Map()
 const fetchImpl=async(url,init)=>{
  assert.equal(init.method??'GET','GET');if(init.redirect)assert.equal(init.redirect,'manual')
  const original=captures.find(r=>new URL(r.requestedUrl).href===url);assert.ok(original,'Undeclared URL '+url)
  const nth=(seen.get(url)||0)+1;seen.set(url,nth);calls.push(url)
  const r={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString()};change(r,url,nth)
  const response=new Response(r.body,{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response
 }
 return {fetchImpl,calls}
}
test('current public published feed retains nine whole reconciled observations and no inferred India jobs',async t=>{
 const transport=replay();t.mock.method(globalThis,'fetch',transport.fetchImpl)
 const jobs=await run({fetchImpl:transport.fetchImpl,now:'2026-11-17T00:00:00Z'})
 assert.deepEqual(jobs,[])
 assert.deepEqual(readSourceObservationEvidence(jobs,'logicfruittechnologies'),{source:'logicfruittechnologies',recordKind:'vacancy-rows',observedRecordCount:9,observedVacancyCount:9,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const evidence=jobs.nativeCollectionEvidence
 assert.equal(evidence.wholeObservedNativeBoardClosingReconciled,true);assert.equal(evidence.companyIndiaZeroProven,false)
 assert.equal(evidence.activeApplyVerified,false);assert.equal(evidence.renderedInventoryBindingVerified,false)
 assert.equal(evidence.observations.length,9);assert.equal(evidence.originalResponses.length,24)
 for(const row of evidence.observations){
  assert.equal(row.country,null);assert.equal(row.applicationURL,null);assert.equal(row.publicationDate,null)
  assert.ok(row.qualificationIssues.includes('native-role-country-unpublished'))
  assert.ok(row.qualificationIssues.includes('whole-rendered-criteria-and-intake-unverified'))
  assert.deepEqual(row.nativeOpeningRecord,row.nativeClosingRecord);assert.deepEqual(row.ownOpeningModel,row.ownClosingModel)
  assert.deepEqual(row.nativeOpeningRecord,row.ownOpeningModel.data)
  assert.equal(Object.hasOwn(row.nativeOpeningRecord,'country'),false)
 }
 assert.equal(transport.calls.filter(url=>url===LIST).length,2);assert.equal(transport.calls.some(url=>url.includes('/admin')),false)
 assert.equal(transport.calls.includes(HOME+'career/jobs-current-opening/'),false)
})
test('an unreviewed current client cannot bind a new source',async()=>{
 const {fetchImpl}=replay((r,url)=>{if(url===MAIN)r.body+='\n/* unreviewed */'})
 await assert.rejects(run({fetchImpl}),/reviewed.*client|client.*changed/i)
})
test('homepage corporate country never qualifies a role and an altered employer fails binding',async()=>{
 const {fetchImpl}=replay((r,url)=>{if(url===HOME)r.body=r.body.replace('"name": "Logic Fruit Technologies"','"name": "Other Employer"')})
 await assert.rejects(run({fetchImpl}),/employer|identity|authority/i)
})
test('a duplicate JSON key and a truncated published count are rejected',async()=>{
 for(const mutate of [r=>r.body=r.body.replace('"success":true','"success":true,"success":true'),r=>{const v=JSON.parse(r.body);v.count++;r.body=JSON.stringify(v)}]){
  const {fetchImpl}=replay((r,url)=>{if(url===LIST)mutate(r)})
  await assert.rejects(run({fetchImpl}),/duplicate|count|incomplete|envelope/i)
 }
})
test('own detail criteria must reconcile with the actual published record',async()=>{
 const {fetchImpl}=replay((r,url)=>{if(url===detail){const v=JSON.parse(r.body);v.data.qualifications+=' Additional mandatory clearance.';r.body=JSON.stringify(v)}})
 await assert.rejects(run({fetchImpl}),/whole.*(detail|record)|list.*detail|criteria/i)
})
test('closing reads compare every native field including an unknown criteria carrier',async()=>{
 const {fetchImpl}=replay((r,url,nth)=>{if(url===LIST&&nth===2){const v=JSON.parse(r.body);v.data[8].newMandatoryCondition='New citizenship restriction';r.body=JSON.stringify(v)}})
 await assert.rejects(run({fetchImpl}),/opening.*closing|whole.*changed|unreviewed.*field/i)
})
test('body-only callbacks cannot replace original HTTP receipts',async()=>{
 await assert.rejects(run({fetchText:async()=>'<html>Logic Fruit</html>'}),/original.*metadata|body-only/i)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {runNativeEInfochips} from './nativeRun.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {CORPORATE,ARROW,API,BOARD} from './nativeGuard.js'
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261020.json',import.meta.url)))
const now='2026-10-21T00:00:00.000Z'
function setup(mutate=()=>{}) {
 const jobs=structuredClone(fixture.jobs),state={calls:[],abort:null}
 const rows=jobs.map(j=>({title:j.title,externalPath:new URL(j.link).pathname.slice('/AC'.length),bulletFields:[j.requisitionId]}))
 const runWorkday=async()=>attachInventoryEvidence(jobs,{status:'complete-inventory',firstParty:true,listingComplete:true,surface:API,pagesFetched:1,reportedTotal:jobs.length,indiaFacetCount:jobs.length,verifiedAt:now})
 const fetchImpl=async(url,options={})=>{state.calls.push({url,options});let payload
  if(url===CORPORATE||url===ARROW)return{status:200,url,text:async()=>url===CORPORATE?fixture.corporate:fixture.arrow}
  if(url===API){const offset=JSON.parse(options.body).offset;payload={total:offset?0:rows.length,jobPostings:offset?[]:structuredClone(rows)}}
  else{const req=jobs.find(j=>url.endsWith(new URL(j.link).pathname.slice('/AC'.length)))?.requisitionId;payload=structuredClone(fixture.details[req])}
  const response={status:200,url,json:async()=>payload};mutate({payload,response,url,state});state.abort?.();return response
 }
 return{fetchImpl,runWorkday,now,timeoutMs:5000,state}
}
test('current native descriptions and complete keyword inventory remain company coverage-gap',async()=>{const options=setup(),jobs=await runNativeEInfochips(options);assert.equal(jobs.length,3);assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,2);assert.ok(jobs.every(j=>j.sourceListingComplete===false));assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,3)})
test('explicit cap zero stays partial and cannot certify empty',async()=>{const jobs=await runNativeEInfochips({...setup(),maxJobs:0});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,3)})
test('native CXS restarts page zero for out-of-range offsets, so total plus short final page determines exhaustion',async()=>{const options=setup(({payload,url})=>{if(url===API&&payload.total===0){payload.total=3;payload.jobPostings=fixture.jobs.map(j=>({title:j.title,externalPath:new URL(j.link).pathname.slice('/AC'.length),bulletFields:[j.requisitionId]}))}});const jobs=await runNativeEInfochips(options);assert.equal(jobs.length,3);assert.ok(options.state.calls.filter(c=>c.url===API).every(c=>JSON.parse(c.options.body).offset===0))})
for(const [label,mutate]of [
 ['HTTP202',({response})=>response.status=202],
 ['redirect',({response})=>response.url='https://other.example/'],
 ['error envelope',({payload,url})=>{if(url===API)payload.Error='failure'}],
 ['coerced count',({payload,url})=>{if(url===API)payload.total=[3]}],
 ['duplicate native ID',({payload,url})=>{if(url===API&&payload.jobPostings.length)payload.jobPostings[1]=structuredClone(payload.jobPostings[0])}],
 ['final count drift',({payload,url,state})=>{if(url===API&&state.calls.filter(c=>c.url===API).length===2)payload.total=4}],
])test('strict native run rejects '+label,async()=>assert.rejects(runNativeEInfochips(setup(mutate))))
test('caller abort after final response is not returned as success',async()=>{const controller=new AbortController(),options=setup(({url,state})=>{if(url===API&&state.calls.filter(c=>c.url===API).length===2)state.abort=()=>controller.abort(new Error('caller abort'))});await assert.rejects(runNativeEInfochips({...options,signal:controller.signal}),/abort/)})
test('incomplete shared enumeration cannot inherit full native health',async()=>{const options=setup();options.runWorkday=async()=>attachInventoryEvidence(structuredClone(fixture.jobs),{status:'discovery-only',listingComplete:false});await assert.rejects(runNativeEInfochips(options),/enumeration/i)})
for(const [field,value]of [['location','New York, United States'],['city','Paris']])test('full wrapper rejects contradictory singular mapped '+field,async()=>{const options=setup(),base=options.runWorkday;options.runWorkday=async()=>{const jobs=await base();jobs[0][field]=value;return jobs};await assert.rejects(runNativeEInfochips(options),/location|city/i)})
test('zero native keyword inventory is coverage-gap, never whole company verified-empty',async()=>{const options=setup();options.runWorkday=async()=>attachInventoryEvidence([],{status:'verified-empty',firstParty:true,listingComplete:true,surface:API,pagesFetched:1,reportedTotal:0,indiaFacetCount:0,verifiedAt:now});options.fetchImpl=async(url)=>({status:200,url,text:async()=>url===CORPORATE?fixture.corporate:fixture.arrow,json:async()=>({total:0,jobPostings:[]})});const jobs=await runNativeEInfochips(options);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')})

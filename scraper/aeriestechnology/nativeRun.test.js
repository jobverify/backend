import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {runNativeAeries} from './nativeRun.js'
import {CORPORATE,BOARD,API,CONTROLLER,MAIN,TEMPLATE,nativeRoleUrl} from './nativeContract.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261021.json',import.meta.url)))
function options(mutate=()=>{}){const calls=[];return{now:'2026-10-21T01:00:00Z',timeoutMs:5000,calls,fetchImpl:async(url,init={})=>{calls.push({url,init});let text=url===CORPORATE?f.corporate:url===BOARD?f.board:url===CONTROLLER?f.controller:url===MAIN?f.main:url===TEMPLATE?f.template:url===API?JSON.stringify({d:JSON.stringify({Jobs:f.rows,JobSuggestion:[]})}):Object.values(f.details).find(d=>d.url===url)?.html;const response={url,status:200,text:async()=>text};mutate(response,calls);return response}}}
test('native all-list response, full details and final stable inventory preserve placeholder health',async()=>{const jobs=await runNativeAeries(options());assert.equal(jobs.length,3);assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,2);assert.ok(jobs.every(j=>j.sourceListingComplete===false));assert.equal(readInventoryEvidence(jobs).reportedTotal,3);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')})
test('caller cap cannot certify complete or zero inventory',async()=>{const jobs=await runNativeAeries({...options(),maxJobs:0});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,3);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
for(const status of [202,403,500])test('HTTP'+status+' returns failure, never zero',async()=>assert.rejects(runNativeAeries(options(r=>r.status=status))))
test('native detail redirect rejects before keeping original identity',async()=>assert.rejects(runNativeAeries(options(r=>{if(r.url.includes('/Search/Jobs/?'))r.url='https://other.example/'}))))
test('final native total or identity drift rejects',async()=>assert.rejects(runNativeAeries(options((r,c)=>{if(r.url===API&&c.filter(x=>x.url===API).length===2)r.text=async()=>JSON.stringify({d:JSON.stringify({Jobs:f.rows.slice(0,2),JobSuggestion:[]})})}))))
test('HTTP200 empty native wrapper is unknown, not empty public inventory',async()=>assert.rejects(runNativeAeries(options(r=>{if(r.url===API)r.text=async()=>JSON.stringify({d:''})}))))
test('caller abort after final response rejects',async()=>{const controller=new AbortController();await assert.rejects(runNativeAeries({...options((r,c)=>{if(r.url===API&&c.filter(x=>x.url===API).length===2)controller.abort(new Error('caller abort'))}),signal:controller.signal}),/abort/)})
test('exact documented all-list empty arrays twice remain fresh complete empty proof',async()=>{const jobs=await runNativeAeries(options(r=>{if(r.url===API)r.text=async()=>JSON.stringify({d:JSON.stringify({Jobs:[],JobSuggestion:[]})})}));assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'verified-empty');assert.equal(readInventoryEvidence(jobs).reportedTotal,0)})

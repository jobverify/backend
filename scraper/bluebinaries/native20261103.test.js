import test from 'node:test'
import assert from 'node:assert/strict'
import {run,CAREER_PAGE_URL,extractNativeInventory} from './script.js'
import {nativeFixture} from '../alkemlaboratories/nativeFixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
globalThis.fetch=async()=>{throw Error('OFFLINE native fixture network tripwire')}
const fixture=nativeFixture(import.meta.url)
const replay=options=>run({fetchPage:fixture.fetchPage,...options})
test('current nine declared native roles retain both conflicting smqe cards and all original criteria',async()=>{
 let audit;const jobs=await replay({onAudit:a=>{audit=a}});assert.equal(jobs.length,0);assert.equal(audit.nativeJobs.length,9);assert.equal(audit.uniqueNativeIdCount,8)
 assert.equal(audit.nativeJobs.filter(r=>r.jobId==='smqe').length,2);assert.ok(audit.nativeJobs.filter(r=>r.jobId==='smqe').every(r=>!r.sourceIdentityComplete&&!r.sourceDetailComplete&&r.sourceNativeCriteria.fullObservedText))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(readSourceObservationEvidence(jobs,'bluebinaries')?.observedRecordCount,9)
})
test('BlueBinaries awaits the observer rejection once',async()=>{const reason={observer:'failed'};let calls=0;await assert.rejects(replay({onAudit:async()=>{calls++;throw reason}}),e=>e===reason);assert.equal(calls,1)})
for(const stage of ['reader','observer'])test('BlueBinaries caller abort settles ignoring '+stage,async()=>{
 const controller=new AbortController(),reason={abort:stage},operation=stage==='reader'?run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})}):replay({signal:controller.signal,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}})
 if(stage==='reader')setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(Promise.race([operation,new Promise((_,reject)=>setTimeout(()=>reject(Error('test abort did not settle')),200))]),e=>e===reason)
})
test('BlueBinaries source deadline bounds ignoring transport without a caller signal',async()=>{await assert.rejects(Promise.race([run({collectionBudgetMs:15,fetchPage:()=>new Promise(()=>{})}),new Promise((_,reject)=>setTimeout(()=>reject(Error('test budget did not settle')),200))]),/deadline/i)})
test('BlueBinaries closing criteria are compared before output caps',async()=>{
 let reads=0,audit;await replay({fetchPage:async(url,init)=>{const response=await fixture.fetchPage(url,init);return url===CAREER_PAGE_URL&&++reads===2?{...response,body:response.body.replace('E/E Architecture Design','Changed native title')}:response},onAudit:a=>{audit=a},maxJobs:1});assert.equal(audit.closingReconciled,false);assert.equal(audit.scopeComplete,false)
})
test('native reveal scripts execute under visually hidden ancestors but never within templates or comments',()=>{
 const board='<section id="job-posts-container" class="job-posts"></section>',client='<script>$(".job-details").on("click",function(){ $("#"+$(this).attr("data-attribute")).toggle(500); });</script>'
 assert.equal(extractNativeInventory(board+'<div hidden>'+client+'</div>').terminal,true)
 assert.equal(extractNativeInventory(board+'<template>'+client+'</template>').terminal,false)
 assert.equal(extractNativeInventory(board+'<!--'+client+'-->').terminal,false)
})
test('a pre-aborted BlueBinaries caller keeps its exact reason before any clock or reader callback',async()=>{
 const controller=new AbortController(),reason={caller:'already aborted'};controller.abort(reason);let calls=0
 await assert.rejects(run({signal:controller.signal,now:()=>{throw Error('clock must not run')},fetchPage:()=>{calls++;throw Error('reader must not run')}}),e=>e===reason);assert.equal(calls,0)
})

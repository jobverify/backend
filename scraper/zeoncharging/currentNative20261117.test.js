import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import https from 'node:https'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
let wire=async()=>{throw Error('Uncaptured network forbidden')};mock.method(globalThis,'fetch',(...args)=>wire(...args));mock.method(https,'request',()=>{throw Error('Uncaptured HTTPS forbidden')})
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
export const replay=(change)=>{let reads=0;return{count:()=>reads,fetchImpl:async(url,init={})=>{const p=structuredClone(fixture.responses[reads++%fixture.responses.length]);assert.equal(url,p.requestedURL);assert.equal(init.redirect,'manual');change?.(p,reads);const response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response}}}
test('zeoncharging actual current originals recover two own roles and hold the different employer independently',async()=>{
 const io=replay();wire=io.fetchImpl
 const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,2);assert.deepEqual(jobs.map(j=>j.jobId),['186003','186004'])
 // The native sales role remains in acquisition; the existing title policy
 // excludes Business Development Executive at publication, independently of age.
 const publication=analyzePublishableJobs(jobs,{now:new Date('2026-11-17T04:00:00Z')})
 assert.equal(publication.eligibleJobs.length,1);assert.equal(publication.filterCounts.excludedTitle,1)
 assert.equal(io.count(),26);assert.equal(e.status,'coverage-gap');assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(audit.observedVacancyCount,3);assert.equal(readSourceObservationEvidence(jobs,'zeoncharging').observedVacancyCount,3);assert.equal(audit.heldRecords.length,1);assert.equal(audit.heldRecords[0].nativeId,'186001');assert.match(audit.heldRecords[0].sourceDescription,/Zeon International/)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.sourceDescription,job.nativeJobPosting.description);assert.equal(job.jobDescription,job.nativeJobPosting.description);assert.equal(job.company,'Zeon Electric Pvt Ltd');assert.equal(job.nativeApplicationForm.attrs.action,'')}
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.closingFullNativeModelsMatch,true);assert.deepEqual(audit.nativeOpeningModel,audit.nativeClosingModel)
})

test('changed closing retains complete observed original model in failed native audit',async()=>{const io=replay((p,i)=>{if(i===fixture.responses.length+2){p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString('utf8')+'<!-- changed complete closing -->').toString('base64')}});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),error=>{assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed,false);assert.equal(error.nativeCollectionEvidence.sourceScopeComplete,false);assert.match(error.nativeCollectionEvidence.observedOriginals.at(-1).text,/changed complete closing/);return true})})
test('native audit finishes before exact frozen or null caller cancellation from reader close',async()=>{for(const reason of [Object.freeze({owner:'zeoncharging-close'}),null])for(const failed of [false,true]){const caller=new AbortController(),io=replay(failed?(p=>{p.status=403}):undefined),fetchImpl=async(url,init)=>{init.signal.addEventListener('abort',()=>caller.abort(reason),{once:true});return io.fetchImpl(url,init)};await assert.rejects(source.run({signal:caller.signal,fetchImpl,requestIntervalMs:0}),error=>error===reason);assert.equal(io.count(),failed?1:fixture.responses.length*2)}})
test('unreviewed programmes and whole publisher forms never silently disappear',async()=>{for(const target of [fixture.responses.findIndex(p=>p.url.endsWith('.js')),fixture.responses.findIndex(p=>p.status===200&&!p.url.endsWith('.js'))]){const io=replay((p,i)=>{if(i===target+1)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString('utf8')+'/* new current context */').toString('base64')});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/profile|native programme bytes/)}})

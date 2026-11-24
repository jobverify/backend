import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {resolveJobsChunkUrl,run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261120.json.gz',import.meta.url))))
const main=fixture.responses.find(p=>p.requestedUrl.includes('/main.')).text
test('Amber resolves the current Jobs route component in its own lexical module despite reused component names',()=>{
 assert.equal(resolveJobsChunkUrl(main),'https://cdn-static-assets.amberstudent.com/amber-user-website/build/assets/js/47863.99bc7c854dfff997.desktop.js')
})
test('Amber refuses a current direct component without the native Jobs route binding',()=>{
 assert.throws(()=>resolveJobsChunkUrl(main.replace('path:"/job-opening",exact:!0,component:eq','path:"/unrelated-route",exact:!0,component:eq')),/route|handoff|module/i)
})
const replay=(edit=()=>{})=>({requestIntervalMs:0,now:()=>fixture.now,fetchImpl:async(url,init)=>{
 assert.equal(init.method,'GET')
 const packet=structuredClone(fixture.responses.find(p=>p.requestedUrl===url));assert.ok(packet,'only captured native declarations: '+url);edit(packet)
 return Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
}})
test('Amber follows both current declared loader steps and pairs original native role criteria without granting full inventory',async()=>{
 const jobs=await run(replay())
 assert.equal(readSourceObservationEvidence(jobs,'amberstudent').observedRecordCount,15)
 assert.ok(jobs.some(job=>job.jobId==='147192'&&job.title==='Associate - Product & AI Operations'&&job.country==='India'))
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceClosingQualified&&job.nativeSourceRecord.description===job.sourceRawDescription))
 for(const id of ['147165','141425','139529','133882'])assert.equal(jobs.some(job=>job.jobId===id),false,'missing native placement remains unqualified: '+id)
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(jobs[0].sourceNativeContract.routeChunks[0].requestedURL,'https://cdn-static-assets.amberstudent.com/amber-user-website/build/assets/js/47863.99bc7c854dfff997.desktop.js')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Amber rejects mixed or changed current main, route bridge, and native Jobs bodies',async()=>{
 for(const edit of [
  p=>{if(p.requestedUrl.includes('/main.'))p.text+=';unreviewedOverride()'},
  p=>{if(p.requestedUrl.includes('/47863.'))p.text=p.text.replace('resolve:()=>34905','resolve:()=>34906')},
  p=>{if(p.requestedUrl.includes('/75004.'))p.text=p.text.replaceAll('amberstudent.keka.com','foreign.keka.com')},
 ])await assert.rejects(run(replay(edit)),/current|route|module|loader|profile|tenant/i)
})

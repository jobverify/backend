import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createNativeLiciousScraper,CURRENT_JOBS_URL} from './nativeInventory.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/handoff-20261118.json.gz',import.meta.url))))
const old=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-app-router-default-20261107.json.gz',import.meta.url))))
const prior=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-declared.json.gz',import.meta.url))))
function replay(change){return{now:()=>old.collectionStartedAt,fetchPage:async(url,init)=>{
 let body;if(url===CURRENT_JOBS_URL)body=current.jobs;else if(url===current.component.url)body=current.component.body
 else{const p=prior.packets.find(p=>p.url===url)||old.packets.find(p=>p.requestedUrl===url&&p.requestBody===(init.body??null));assert.ok(p,url);body=Buffer.from(p.bodyBase64,'base64').toString()}
 return{url,status:200,body:change?.(url,body)??body}
}}}
test('current Licious component deployment preserves native observations without inventing country',async()=>{const options=replay(),jobs=await createNativeLiciousScraper({now:options.now}).run(options);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,32);assert.ok(jobs.nativeCollectionEvidence.observations.every(r=>r.detailRecord));assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)})
test('current Licious whole component guard rejects modified initialization',async()=>{const options=replay((url,body)=>url===current.component.url?body.replace('"careers","licious"','"careers","foreign"'):body);await assert.rejects(createNativeLiciousScraper({now:options.now}).run(options),/client contract changed/)})

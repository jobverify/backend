import test from 'node:test'
import assert from 'node:assert/strict'
import {withCurrentPublicProbe} from './publicProbe.js'
test('current public observer deadlines and rejected observer identities are bounded',async()=>{
 const error=Error('observer failed');await assert.rejects(withCurrentPublicProbe('aurobindopharma',{onAudit:async()=>{throw error}},context=>context.audit({nativeInventoryComplete:false})),caught=>caught===error)
 await assert.rejects(withCurrentPublicProbe('aurobindopharma',{collectionTimeoutMs:20,onAudit:()=>new Promise(()=>{})},context=>context.audit({nativeInventoryComplete:false})),caught=>caught.name==='TimeoutError')
})
test('current public supplied readers preserve opaque cancellation and block native denial retries',async()=>{
 const controller=new AbortController(),reason={opaque:true};const pending=withCurrentPublicProbe('affordmed',{signal:controller.signal,fetchPage:()=>new Promise(()=>{})},context=>context.read('https://www.affordmed.com/careers'));setTimeout(()=>controller.abort(reason),5);await assert.rejects(pending,caught=>caught===reason)
 let calls=0;await withCurrentPublicProbe('byjus',{fetchPage:async url=>{calls++;return{url,status:429,headers:{'retry-after':'60'},html:'Denied'}}},async context=>{for(const url of['https://byjus.com/careers-at-byjus/','https://byjus.com/another-path'])await assert.rejects(context.read(url),error=>error.status===429&&error.retryDelayMs===60000&&error.abortRetries===true)});assert.equal(calls,1)
})

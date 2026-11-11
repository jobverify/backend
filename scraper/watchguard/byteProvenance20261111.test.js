import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {extractionFailureDetails} from '../../scripts/catalogExtractionFailureEvidence.js'
import {retainNativeFailureArtifact} from '../../scripts/catalogExtractionFailureArtifacts.js'
import {withRetry} from '../../scraper-support/utils/retry.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime20261111.json.gz',import.meta.url)))),packets=fixture.responses.filter(p=>p.kind!=='corporate')
const raw=Buffer.from([255,254,192]),sha=bytes=>createHash('sha256').update(bytes).digest('hex')
// Controlled malformed responses use genuine resource identity and native
// Response status. No live access-denial or malformed publication is asserted.
function replay(target,status){let index=0;const calls=[];return{calls,fetchImpl:async(url,init)=>{
 const p=packets[index];assert.ok(p,'unexpected source request');assert.equal(url,p.requestedURL);assert.equal(init.redirect,'manual');calls.push(url)
 const selected=index++===target,response=new Response(selected?raw:Buffer.from(p.bodyBase64,'base64'),{status:selected?status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalURL});return response
}}}
for(const [phase,target]of[['primary',0],['closing-native-array',36]])for(const status of[200,403])test(phase+' actual HTTP '+status+' malformed UTF8 retains real byte/status provenance and fails closed',async()=>{
 const r=replay(target,status);let error
 try{await run({fetchImpl:r.fetchImpl});assert.fail('malformed text must hold source')}catch(e){error=e}
 assert.equal(r.calls.length,target+1);assert.ok(error);assert.equal(error.abortRetries,true)
 const evidence=error.nativeEvidence,packet=evidence.retainedResponses[target];assert.equal(evidence.observedListingCount,null);assert.equal(evidence.inventoryComplete,false);assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(packet.status,status);assert.equal(packet.rawBodyBase64,raw.toString('base64'));assert.equal(packet.bodyBytes,raw.length);assert.equal(packet.bodySHA256,sha(raw));assert.equal(packet.url,packets[target].requestedURL);assert.equal(packet.finalURL,packets[target].finalURL);assert.ok(packet.completedAt>=packet.requestedAt)
 if(status===403){assert.equal(error.status,403);assert.equal(extractionFailureDetails(error).failureKind,'blocked_or_access_denied')}
 else assert.equal(error.code,'ERR_ENCODING_INVALID_ENCODED_DATA')
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'watchguard-malformed-bytes-'))
 try{const saved=retainNativeFailureArtifact(error,{outputDirectory:directory,source:'watchguard',attemptedAt:new Date().toISOString(),completedAt:new Date().toISOString()});assert.equal(saved.retainedResponses,target+1);assert.equal(saved.rejectedResponses,0);const artifact=JSON.parse(fs.readFileSync(path.join(directory,saved.filename))),retained=artifact.retainedResponses[target];assert.equal(retained.status,status);assert.equal(retained.rawBodyBase64,raw.toString('base64'));assert.equal(retained.bodySHA256,sha(raw));assert.equal(artifact.qualifiedJobCounts,null);assert.equal(artifact.cleanupAllowed,false)}finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));fs.rmSync(directory,{recursive:true,force:true})}
})
for(const [phase,target]of[['primary',0],['closing-native-array',36]])test(phase+' malformed403 never retries the source or origin through actual outer retry policy',async()=>{
 let attempts=0,requests=0,last
 await assert.rejects(withRetry(async()=>{attempts++;const r=replay(target,403);try{return await run({fetchImpl:async(...args)=>{requests++;return r.fetchImpl(...args)}})}catch(error){last=error;throw error}},{attempts:2,baseDelayMs:0,label:'watchguard-malformed403'}))
 assert.equal(attempts,1);assert.equal(requests,target+1);assert.equal(last.status,403);assert.equal(last.abortRetries,true);assert.equal(extractionFailureDetails(last).failureKind,'blocked_or_access_denied')
})

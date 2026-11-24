import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const primaryBytes=fs.readFileSync(new URL('./fixtures/current-registered-20261121.json.gz',import.meta.url))
assert.equal(createHash('sha256').update(primaryBytes).digest('hex'),'c1a9cd2f79c1eb508d6ba1aff26cf8109b0dbf811c6bb7a2c4b17267b6ceffde')
const primary=JSON.parse(gunzipSync(primaryBytes)),programme=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-programme-20261121.json.gz',import.meta.url))))
const packets=[...primary.responses,...programme.responses],provider=getScraperCatalog().find(row=>row.source==='cloudinary')
assert(provider)

async function registered(configuration,{rejectClosing=false}={}){
 const calls=[],unexpected=[],original=globalThis.fetch
 let jobs,error
 globalThis.fetch=async(target,init={})=>{
  const url=String(target),index=calls.length,packet=packets[index]
  calls.push({url,method:init.method??'GET',redirect:init.redirect??null})
  if(!packet||packet.requestedURL!==url){
   // A permissive offline response lets any erroneous generic recovery finish;
   // an assertion here would hide that recovery behind a transport exception.
   unexpected.push(url)
   return Object.defineProperty(new Response('<html><title>Not found</title></html>',{status:404,headers:{'content-type':'text/html'}}),'url',{value:url})
  }
  const headers=structuredClone(packet.headers)
  if(rejectClosing&&index===9)headers['content-security-policy']="script-src 'none'"
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers})
  return Object.defineProperty(response,'url',{value:packet.finalURL})
 }
 try{jobs=await createCatalogScraper(configuration).run({requestIntervalMs:0,sourceTimeoutMs:20000})}catch(caught){error=caught}finally{globalThis.fetch=original}
 return{jobs,error,calls,unexpected}
}

test('actual registered Cloudinary reconciles original legacy payload with the finite current programme',async t=>{
 t.mock.method(console,'warn',()=>{})
 const {jobs,error,calls,unexpected}=await registered(provider)
 assert.equal(error,undefined);assert.deepEqual(unexpected,[]);assert.equal(calls.length,11)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.priorNativePayloadReconciled,true);assert.equal(jobs.nativeCollectionEvidence.programmeRequestCount,6)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,JSON.parse(Buffer.from(programme.responses[2].bodyBase64,'base64')))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,6);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false);assert.equal(jobs.nativeCollectionEvidence.companyGlobalScopeQualified,false)
})
for(const[label,configuration]of [['exact authority counterfactual',{...provider,authoritativeCurrentPublication:true}],['actual effective registration',provider]])test('registered Cloudinary stops after native policy rejection: '+label,async t=>{
 t.mock.method(console,'warn',()=>{})
 const {jobs,error,calls,unexpected}=await registered(configuration,{rejectClosing:true})
 assert.equal(jobs,undefined);assert.match(error?.message??'',/Cloudinary programme: Enforced CSP/)
 assert.equal(error.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,false)
 assert.equal(calls.length,10,'No alternate acquisition after authoritative rejection: '+JSON.stringify({calls,unexpected,recovery:error.softFailureRecruitmentRecovery??null}))
 assert.deepEqual(unexpected,[]);assert.equal(error.softFailureRecruitmentRecovery,undefined)
})

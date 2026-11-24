import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const raw=fs.readFileSync(new URL('./test-data-20261121/current-originals.json.gz',import.meta.url))
const manifest=JSON.parse(fs.readFileSync(new URL('./test-data-20261121/manifest.json',import.meta.url)))
assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.fixtureSHA256)
const fixture=JSON.parse(gunzipSync(raw)),provider=getScraperCatalog().find(row=>row.source==='kreetitechnologies')
assert(provider)
async function registered(configuration,{unknownCorporate=false}={}){
 const calls=[],unexpected=[],original=globalThis.fetch;let jobs,error
 globalThis.fetch=async(target,init={})=>{
  const url=String(target),index=calls.length
  calls.push({url,method:init.method??'GET',redirect:init.redirect??null})
  const packet=Object.values(fixture.packets).find(row=>row.requestedURL===url)
  if(!packet){
   unexpected.push(url)
   // Let alternate discovery finish offline, so native rejection cannot hide
   // recovery behind an assertion or an unmatched transport exception.
   return Object.defineProperty(new Response('<html><title>Not found</title></html>',{status:404,headers:{'content-type':'text/html'}}),'url',{value:url})
  }
  let body=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'),packet.bodySHA256)
  if(unknownCorporate&&index===0)body=Buffer.concat([body,Buffer.from('\n')])
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }
 try{jobs=await createCatalogScraper(configuration).run({requestIntervalMs:0,sourceTimeoutMs:20000})}catch(caught){error=caught}finally{globalThis.fetch=original}
 return{jobs,error,calls,unexpected}
}

test('actual registered Kreeti qualifies fourteen original-body reads and keeps company totals unavailable',async t=>{
 t.mock.method(console,'warn',()=>{})
 assert.equal(provider.authoritativeCurrentPublication,true)
 const {jobs,error,calls,unexpected}=await registered(provider)
 assert.equal(error,undefined);assert.deepEqual(unexpected,[])
 assert.deepEqual(calls.map(row=>row.url),fixture.sequence.map(id=>fixture.packets[id].requestedURL))
 assert.equal(calls.length,14);assert.equal(jobs.length,0)
 assert(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)))
 assert.equal(jobs.nativeCollectionEvidence.nativeProgrammeScopeComplete,true)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})
for(const[label,configuration]of [['exact authority counterfactual',{...provider,authoritativeCurrentPublication:true}],['actual effective registration',provider]])test('registered Kreeti stops at one rejected publisher read: '+label,async t=>{
 t.mock.method(console,'warn',()=>{})
 const {jobs,error,calls,unexpected}=await registered(configuration,{unknownCorporate:true})
 assert.equal(jobs,undefined);assert.match(error?.message??'',/current corporate publisher document requires review/)
 assert.equal(calls.length,1,JSON.stringify({calls,unexpected,recovery:error?.softFailureRecruitmentRecovery??null}))
 assert.deepEqual(unexpected,[]);assert.equal(error.softFailureRecruitmentRecovery,undefined)
})
test('removing only the authority flag reproduces alternate recovery after native publisher rejection',async t=>{
 t.mock.method(console,'warn',()=>{})
 const configuration={...provider};delete configuration.authoritativeCurrentPublication
 const {jobs,error,calls,unexpected}=await registered(configuration,{unknownCorporate:true})
 assert.equal(jobs,undefined);assert.match(error?.message??'',/current corporate publisher document requires review/)
 assert.equal(calls.length,7);assert.equal(calls[0].url,fixture.packets.company.requestedURL)
 assert(unexpected.length>0);assert(error.softFailureRecruitmentRecovery)
})

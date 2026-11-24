import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {runScraperWithTimeout} from '../../scraper-support/runner.js'
const sha=b=>createHash('sha256').update(b).digest('hex')
const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-prefix-20261121.json.gz',import.meta.url))))
const packets=new Map(fixture.responses.map(row=>{const body=Buffer.from(row.bodyBase64,'base64');assert.equal(body.length,row.receipt.persistedBytes);assert.equal(sha(body),row.receipt.persistedSHA256);return[row.kind,{...row,body}]}))
const expectedJob=JSON.parse(packets.get('job5856345').body)
const accountURL='https://apply.workable.com/api/v1/accounts/valutico-2?full=true'
function controlled(){
 const requests=[],unretained=[],counts=new Map
 const map=new Map
 for(const[kind,p]of packets){
  const requested=kind==='account'?accountURL:p.receipt.requestedURL
  map.set(requested,p)
 }
 return{requests,unretained,async fetch(url,init={}){
  assert.equal(init.method??'GET','GET');assert.equal(init.body??null,null)
  url=String(url);requests.push(url);counts.set(url,(counts.get(url)??0)+1)
  if((counts.get(url)??0)>1)throw Error('CONTROLLED_REPEATED_PREFIX_READ '+url)
  const p=map.get(url)
  if(!p){unretained.push(url);throw Error('CONTROLLED_UNOBSERVED_CURRENT_COUNTERPART')}
  const response=new Response(p.body,{status:p.receipt.status,headers:p.receipt.headers})
  Object.defineProperty(response,'url',{value:p.kind==='account'?accountURL:p.receipt.finalURL})
  return response
 }}
}
function checkHeldNative(error,transport){
 assert.ok(error,'Missing current role counterpart must hold, not become empty/complete')
 const audit=error.nativeCollectionEvidence
 assert.ok(audit?.nativeRoleObservations,'Source must retain its actual full native model after resolving same-account modern handoff; baseline discards it on stale redirect-authority rejection: '+error.message)
 assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)
 assert.equal(audit.nativeRoleObservations.length,9)
 const first=audit.nativeRoleObservations.find(row=>row.legacyNativeId===5856345)
 assert.ok(first);assert.deepEqual(first.nativeJob,expectedJob)
 assert.equal(first.nativeCountry,'United Kingdom');assert.equal(first.nativePublicationDate,'2026-06-02T00:00:00.000Z')
 assert.equal(first.sourceCountryQualifiedForIndia,false)
 assert.equal(audit.wholeNativeRoleModelsClosingReconciled,false)
 assert.ok(audit.nativeRoleObservations.some(row=>row.nativeJob===null&&row.currentCounterpartObserved===false),'Other unpublished/unobserved counterpart is not invented')
 assert.equal(transport.requests.length,8,'No registered generic fallback/retry calls after native stop')
 assert.deepEqual(transport.unretained,['https://apply.workable.com/api/v2/accounts/valutico-2/jobs/781AECB51D'])
 assert.ok(transport.requests.includes(accountURL))
 assert.ok(transport.requests.includes('https://apply.workable.com/api/v2/accounts/valutico-2/jobs/720E76FE8A'))
 assert.ok(!transport.requests.some(url=>/linkedin|widget|jobs\.workable\.com/i.test(url)))
}
test('direct current source retains full real modern Valutico job and9cards while unobserved counterparts remain held',async()=>{
 const transport=controlled(),prior=globalThis.fetch;globalThis.fetch=transport.fetch
 let error
 try{await run({fetchImpl:transport.fetch,requestIntervalMs:0})}catch(e){error=e}finally{globalThis.fetch=prior}
 checkHeldNative(error,transport)
})
test('actual registered no-options dispatch retains the same current native prefix, not a script-only verification',async()=>{
 const transport=controlled(),prior=globalThis.fetch;globalThis.fetch=transport.fetch
 let error
 try{
  const provider=getScraperCatalog().find(p=>p.source==='valuticoindia')
  assert.ok(provider);await runScraperWithTimeout(createCatalogScraper(provider),undefined,{abortGraceMs:1500})
 }catch(e){error=e}finally{globalThis.fetch=prior}
 checkHeldNative(error,transport)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-data-20261121.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='snowplow')
assert(provider)
async function registered({unknownCorporate=false,changedClosingCriteria=false}={}){
 const calls=[],unexpected=[],saved=globalThis.fetch;let jobs,error
 globalThis.fetch=async(target,init={})=>{
  const url=String(target),at=calls.length
  calls.push({url,method:init.method??'GET',headers:init.headers??null})
  const packet=Object.values(fixture.packets).find(row=>row.requestUrl===url)
  if(!packet){
   unexpected.push(url)
   // Permissive alternate transport proves actual recovery behaviour; an
   // unmatched mock exception must never hide an attempted generic fallback.
   return Object.defineProperty(new Response('<html><title>Not found</title></html>',{status:404,headers:{'content-type':'text/html'}}),'url',{value:url})
  }
  let body=packet.body+(unknownCorporate&&at===0?'\n':'')
  if(changedClosingCriteria&&url===fixture.packets.feed.requestUrl&&calls.filter(row=>row.url===url).length===2){
   const value=JSON.parse(body);value.jobAdDetails[0].description+='<p>Mandatory additional clearance.</p>';body=JSON.stringify(value)
  }
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 }
 try{jobs=await createCatalogScraper(provider).run({requestIntervalMs:0,sourceTimeoutMs:20000})}catch(caught){error=caught}finally{globalThis.fetch=saved}
 return{jobs,error,calls,unexpected}
}
test('actual registered Snowplow preserves finite original DATA observations without alternate discovery or India zero',async t=>{
 t.mock.method(console,'warn',()=>{})
 const{jobs,error,calls,unexpected}=await registered()
 assert.equal(error,undefined)
 assert.deepEqual(unexpected,[])
 assert.deepEqual(calls.map(row=>row.url),fixture.sequence.map(id=>fixture.packets[id].requestUrl))
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.nativeInventoryCount,14)
 assert.equal(jobs.nativeCollectionEvidence.nativeDataClosingReconciled,true)
 assert.equal(jobs.nativeCollectionEvidence.applicationCriteriaReviewed,false)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.equal(readSourceObservationEvidence(jobs,'snowplow').observedRecordCount,14)
})
test('actual registered Snowplow holds unknown current authority after its first public response',async t=>{
 t.mock.method(console,'warn',()=>{})
 const{jobs,error,calls,unexpected}=await registered({unknownCorporate:true})
 assert.equal(jobs,undefined);assert(error)
 assert.equal(calls.length,1,JSON.stringify({calls,unexpected,recovery:error.softFailureRecruitmentRecovery??null,authority:provider.authoritativeCurrentPublication??false}))
 assert.deepEqual(unexpected,[])
 assert.equal(error.inventoryEvidence.indiaFacetCount,null)
 assert.equal(error.softFailureRecruitmentRecovery,undefined)
})
test('actual registered Snowplow holds closing criteria drift without alternate recovery or completeness promotion',async t=>{
 t.mock.method(console,'warn',()=>{})
 const{jobs,error,calls,unexpected}=await registered({changedClosingCriteria:true})
 assert.equal(jobs,undefined);assert(error)
 assert.equal(calls.length,14);assert.deepEqual(unexpected,[])
 assert.equal(error.nativeEvidence.nativeInventoryCount,14)
 assert.equal(error.nativeEvidence.nativeDataClosingReconciled,false)
 assert.equal(error.inventoryEvidence.indiaFacetCount,null)
 assert.equal(error.inventoryEvidence.listingComplete,false)
 assert.equal(error.softFailureRecruitmentRecovery,undefined)
})

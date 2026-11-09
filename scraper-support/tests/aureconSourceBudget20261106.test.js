import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/aureconWorksites20261106/capture.json.gz',import.meta.url))))
const api='https://aurecongroup.wd3.myworkdayjobs.com/wday/cxs/aurecongroup/aurecon/jobs',board='https://aurecongroup.wd3.myworkdayjobs.com/en-US/aurecon'
const detail=fixture.responses.find(r=>r.receipt.requestedUrl.includes('/wday/cxs/'))
const info=JSON.parse(Buffer.from(detail.bodyBase64,'base64')).jobPostingInfo
const registered=()=>createCatalogScraper(getScraperCatalog().find(r=>r.source==='aurecon'))
// Every saved response body is genuine. One-role listing and anonymous board
// envelopes are explicit synthetic controls, not complete live native inventory.
const mock=(t)=>{
 const calls=[]
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input);calls.push({url,method:init.method||'GET'});let body,status=200,headers={}
  if(url===board){body='<html>Synthetic anonymous bootstrap</html>';headers['content-type']='text/html'}
  else if(url===api){assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body).appliedFacets,{});body=JSON.stringify({total:1,jobPostings:[{title:info.title,externalPath:new URL(info.externalUrl).pathname.replace('/aurecon',''),locationsText:'4 Locations',bulletFields:[info.jobReqId],postedOn:'Posted Today'}]});headers['content-type']='application/json'}
  else{
   const row=fixture.responses.find(r=>r.receipt.requestedUrl===url);assert.ok(row,'No implicit public network: '+url)
   body=row.bodyBase64===null?null:Buffer.from(row.bodyBase64,'base64');status=row.receipt.status;headers['content-type']=row.receipt.contentType
   if(body)assert.equal(createHash('sha256').update(body).digest('hex'),row.receipt.sha256)
   if(row.receipt.location)headers.location=row.receipt.location
  }
  const response=new Response(body,{status,headers});Object.defineProperty(response,'url',{value:url});return response
 });return calls
}
for(const timeoutMs of [300000,600000])test('Registered Aurecon accepts explicit bounded caller budget '+timeoutMs+' within the existing proof ceiling',async t=>{
 const calls=mock(t);let audit
 const jobs=await registered().run({timeoutMs,requestTimeoutMs:2000,nativeDetailRecovery:false,onAudit:r=>{audit=r},requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}}})
 assert.equal(jobs.length,0,'The authentic control role is foreign')
 assert.equal(audit.nativeCountryProof.initial.count,1);assert.equal(audit.nativeCountryProof.closing.count,1)
 assert.equal(audit.configuredBoardScopeComplete,true);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(calls.filter(r=>r.url===api).length,2)
})
test('Registered Aurecon rejects budgets above the existing ten-minute proof ceiling before IO',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('No public request is allowed')})
 await assert.rejects(registered().run({timeoutMs:600001}),/invalid public attempt budget/);assert.equal(calls,0)
})
test('Registered Aurecon keeps the existing three-minute default source budget',async t=>{
 const delays=[],original=globalThis.setTimeout;mock(t)
 t.mock.method(globalThis,'setTimeout',function(fn,ms,...args){delays.push(ms);return original(fn,ms,...args)})
 await registered().run({requestTimeoutMs:2000,nativeDetailRecovery:false,requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}}})
 assert.equal(delays[0],180000)
})
test('Registered Aurecon preserves exact caller cancellation with an extended bounded budget',async t=>{
 const controller=new AbortController(),reason=Object.freeze({syntheticExtendedBudgetCancellation:true});let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;controller.abort(reason);return new Promise(()=>{})})
 await assert.rejects(registered().run({timeoutMs:300000,signal:controller.signal}),error=>error===reason);assert.equal(calls,1)
})

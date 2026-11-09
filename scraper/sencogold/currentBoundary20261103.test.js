import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {CAREERS_URL,createSencoGoldScraper,run} from './script.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'

globalThis.fetch=async()=>{throw Error('Offline source tests prohibit live network')}
const html=()=>gunzipSync(readFileSync(new URL('./test-data/current-20261103/career.html.gz',import.meta.url))).toString('utf8')
const page=(body=html(),status=200)=>({status,url:CAREERS_URL,html:body})

test('an expired certificate remains a source failure, preserving its cause',async()=>{
 const failure=Object.assign(new Error('fetch failed'),{cause:Object.assign(new Error('certificate has expired'),{code:'CERT_HAS_EXPIRED'})})
 await assert.rejects(createSencoGoldScraper().run({fetchPage:async()=>{throw failure}}),e=>e===failure&&!e.abortPipeline&&!e.isPipelineFatal)
})
test('current public free-text resume form is observed twice with unknown vacancy inventory',async()=>{
 const calls=[],audits=[]
 const jobs=await run({fetchPage:async(url,request)=>{calls.push({url,request});return page()},onAudit:a=>audits.push(a)})
 assert.equal(calls.length,2);assert.equal(audits.length,1);assert.equal(jobs.length,0)
 assert.equal(audits[0].observations[0].kind,'general-resume-intake')
 assert.equal(audits[0].observations[0].jobId,null)
 assert.equal(audits[0].inventoryEvidence.listingComplete,false)
 assert.equal(audits[0].inventoryEvidence.reportedTotal,null)
 assert.equal(audits[0].companyIndiaTotal,null);assert.equal(audits[0].lifecycleCleanupAllowed,false)
 assert(!JSON.stringify(audits).includes('_token'));assert(!JSON.stringify(audits).includes('[REDACTED_PUBLIC_FORM_TOKEN]'))
 for(const call of calls)assert.equal(call.request.method,'GET')
})
for(const status of [401,403,429])test('HTTP '+status+' remains a typed source-local denial without repeat reads',async()=>{
 let calls=0
 await assert.rejects(run({fetchPage:async()=>{calls++;return page('<h1>Denied</h1>',status)}}),e=>e.status===status&&e.code==='SENCO_PUBLIC_ACCESS_DENIED'&&e.abortRetries===true&&!e.abortPipeline&&!e.isPipelineFatal)
 assert.equal(calls,1)
})
test('response URL and status are qualified before accepting the form',async()=>{
 for(const response of [{...page(),url:'https://example.com/'},page(html(),500),html()])await assert.rejects(run({fetchPage:async()=>response}))
})
test('inert form text cannot establish the current hiring intake',async()=>{
 for(const body of ['<template>'+html()+'</template>','<!--'+html()+'-->'])await assert.rejects(run({fetchPage:async()=>page(body)}))
})
test('HTML input type casing preserves the same intake and excludes hidden field names',async()=>{
 const body=html().replace(/type="([^"]+)"/g,(whole,type)=>'type="'+type.toUpperCase()+'"'),audits=[]
 const jobs=await run({fetchPage:async()=>page(body),onAudit:a=>audits.push(a)})
 assert.equal(jobs.length,0);assert.equal(audits[0].inventoryEvidence.listingComplete,false)
 assert(!JSON.stringify(audits[0]).includes('_token'))
})
test('a changed closing form is held instead of returning an old empty result',async()=>{
 let calls=0
 await assert.rejects(run({fetchPage:async()=>page(++calls===1?html():html().replace('name="position_applying_for"','name="role_selector"'))}))
 assert.equal(calls,2)
})
test('readers and audit observers ignoring cancellation remain bounded',async()=>{
 for(const options of [{fetchPage:()=>new Promise(()=>{})},{fetchPage:async()=>page(),onAudit:()=>new Promise(()=>{})}])await assert.rejects(run({...options,collectionBudgetMs:25}),e=>e.name==='TimeoutError')
})
test('exact caller reason propagates to the bounded transport signal',async()=>{
 const controller=new AbortController(),reason={callerStopped:true};let signal
 const pending=run({signal:controller.signal,fetchPage:async(url,request)=>{signal=request.signal;controller.abort(reason);return page()}})
 await assert.rejects(pending,e=>e===reason);assert.equal(signal.aborted,true);assert.equal(signal.reason,reason)
})
test('default reader bounds body lifetime and cancels early rejected responses',async()=>{
 let signal,cancelled=0
 await assert.rejects(run({fetchImpl:async(url,request)=>{signal=request.signal;return{status:500,url,body:{cancel:async()=>{cancelled++}}}}}))
 assert.equal(cancelled,1);assert.equal(signal.aborted,true)
 await assert.rejects(run({collectionBudgetMs:25,fetchImpl:async(url)=>({status:200,url,text:()=>new Promise(()=>{})})}),e=>e.name==='TimeoutError')
})
test('catalog requires current evidence and carries no historical empty-inventory promise',()=>{
 const source=getScraperCatalog().find(row=>row.source==='sencogold')
 assert.equal(source.zeroResultPolicy,'evidence-required');assert.equal(source.verifiedOn,null)
 assert.equal(source.verifiedPublicJobCount,null);assert.equal(source.verifiedIndiaJobCount,null)
 assert.equal(source.sourceScopeComplete,false);assert.equal(source.lifecycleCleanupAllowed,false)
})
test('supplied readers receive collection and request deadlines without aborting the caller',{timeout:1000},async()=>{
 for(const bounds of [{collectionBudgetMs:20},{collectionBudgetMs:200,requestTimeoutMs:20}]){
  const caller=new AbortController();let transportSignal
  await assert.rejects(run({...bounds,signal:caller.signal,fetchPage:async(url,request)=>{transportSignal=request.signal;return new Promise(()=>{})}}),e=>e.name==='TimeoutError')
  assert.equal(transportSignal.aborted,true);assert.equal(caller.signal.aborted,false)
 }
})

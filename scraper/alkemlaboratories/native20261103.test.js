import test from 'node:test'
import assert from 'node:assert/strict'
import {run,CAREERS_PAGE_URL} from './script.js'
import {nativeFixture} from './nativeFixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
globalThis.fetch=async()=>{throw Error('OFFLINE native fixture network tripwire')}
const fixture=nativeFixture(import.meta.url),native='https://alkem.turbohire.co/',api='https://thapi-stage2.azurewebsites.net'
const replay=async(transform=(url,body)=>body,options={})=>{let audit;const reads=[];const jobs=await run({fetchPage:async(url,init)=>{reads.push({url,method:init.method});const response=await fixture.fetchPage(url,init);return{...response,body:transform(url,response.body)}},onAudit:a=>{audit=a},...options});return{jobs,audit,reads}}
test('current active SearchJobs handler reaches employer-bound public TurboHire and reconciles native zero',async()=>{
 const{jobs,audit,reads}=await replay();assert.equal(jobs.length,0);assert.ok(reads.some(r=>r.url===native));assert.ok(!reads.some(r=>r.url.includes('careers.alkemlabs.com')))
 const e=readInventoryEvidence(jobs);assert.equal(e.status,'verified-empty');assert.equal(e.reportedTotal,0);assert.equal(e.indiaFacetCount,0);assert.equal(e.listingComplete,true)
 assert.equal(audit.closingReconciled,true);assert.equal(audit.observedGlobalCount,0);assert.equal(audit.scopeComplete,true);assert.equal(audit.anonymousSessionCredentialsRetained,false)
 assert.doesNotMatch(JSON.stringify(audit),/synthetic-public-visitor-token/)
})
for(const change of ['organization','total','continuation','positive','client','css','nomodule','hidden-class','native-nomodule'])test('unproved '+change+' cannot become verified native zero',async()=>{
 let audit
 await assert.rejects(replay((url,body)=>{
  if(change==='organization'&&url.includes('/publicorganizations?'))return body.replace('Alkem Laboratories Limited','Other Employer')
  if(url.includes('/filteredjobs?')){
   if(change==='total')return '{"Total":1,"Result":[]}'
   if(change==='continuation')return '{"Total":0,"Result":[],"HasMore":true}'
   if(change==='positive')return '{"Total":1,"Result":[{"JobId":"native-future","JobTitle":"Public engineer"}]}'
  }
  if(change==='client'&&url.includes('0t0u76_jp6cfa.js'))return body.replace('https://alkem.turbohire.co/','https://other.turbohire.co/')
  if(change==='css'&&url.endsWith('.css'))return body+'\n.work-with-us .btn{display:none!important}'
  if(change==='nomodule'&&url===CAREERS_PAGE_URL)return body.replace('<script src="https://www.alkemlabs.com/_next/static/chunks/0t0u76_jp6cfa.js"','<script nomodule src="https://www.alkemlabs.com/_next/static/chunks/0t0u76_jp6cfa.js"')
  if(change==='hidden-class'&&url===CAREERS_PAGE_URL)return body.replace('<button class="btn">SEARCH JOBS</button>','<button class="btn d-none">SEARCH JOBS</button>')
  if(change==='native-nomodule'&&url===native)return body.replace('<script src="/main.7e7da7778c91318d8d82.chunk.js"','<script nomodule src="/main.7e7da7778c91318d8d82.chunk.js"')
  return body
 },{onAudit:a=>{audit=a}}),/Alkem|native|public/i)
 if(change==='positive'){assert.equal(audit.observations.length,1);assert.equal(audit.scopeComplete,false)}
})
test('hidden corporate SearchJobs control is not a current active native handoff',async()=>{
 await assert.rejects(replay((url,body)=>url===CAREERS_PAGE_URL?body.replace('<button class="btn">SEARCH JOBS</button>','<button class="btn" hidden>SEARCH JOBS</button>'):body),/handoff|Search|Alkem/i)
})
test('Alkem awaits observer and preserves its exact rejection',async()=>{
 const reason={observer:'failed'};let calls=0
 await assert.rejects(replay(undefined,{onAudit:async()=>{calls++;await Promise.resolve();throw reason}}),e=>e===reason);assert.equal(calls,1)
})
for(const stage of ['reader','observer'])test('Alkem caller abort bounds an ignoring '+stage,async()=>{
 const controller=new AbortController(),reason={abort:stage};const operation=stage==='reader'?run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})}):replay(undefined,{signal:controller.signal,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}})
 if(stage==='reader')setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(Promise.race([operation,new Promise((_,reject)=>setTimeout(()=>reject(Error('test abort did not settle')),200))]),e=>e===reason)
})
test('Alkem stops at the first public denial',async()=>{let reads=0;await assert.rejects(run({fetchPage:async url=>{reads++;return{status:403,url,body:'Denied'}}}),/403|denied/i);assert.equal(reads,1)})
test('unrelated analytics removal does not veto the employer-bound public native inventory',async()=>{
 let changed=0;const{jobs}=await replay((url,body)=>{if(url!==native)return body;const next=body.replace(/<script\b[^>]*src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?[^>]*>[\s\S]*?<\/script>/,'');if(next!==body)changed++;return next});assert.equal(changed,2);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('private account UI copy in the native bundle is not a public vacancy API gate',async()=>{
 const url='https://alkem.turbohire.co/main.7e7da7778c91318d8d82.chunk.js',original=fixture.get(url),needle=['Forgot Password','Reset Password','Confirm Password','Upload Resume','Password must','New Password','Job Application','password'].find(value=>original.includes(value));assert.ok(needle);let changed=0
 const{jobs}=await replay((target,body)=>{if(target!==url)return body;const next=body.replace(needle,needle+' (updated private account label)');if(next!==body)changed++;return next});assert.equal(changed,2);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('changed public native listing endpoint remains a source contract gap',async()=>{
 await assert.rejects(replay((url,body)=>url==='https://alkem.turbohire.co/main.7e7da7778c91318d8d82.chunk.js'?body.replaceAll('/api/careerpagev2/filteredjobs?','/api/careerpagev2/otherjobs?'):body),/public|native|contract/i)
})
test('private account copy in a public dependency chunk does not change the selected inventory controller',async()=>{
 const url='https://alkem.turbohire.co/40.e80abef59f2eb20758a7.chunk.js',original=fixture.get(url),needle=['Forgot Password','Reset Password','Confirm Password','Upload Resume','Password must','New Password','password'].find(value=>original.includes(value));assert.ok(needle);let changed=0
 const{jobs}=await replay((target,body)=>{if(target!==url)return body;const next=body.replace(needle,needle+' (private copy updated)');if(next!==body)changed++;return next});assert.equal(changed,2);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('unrelated lazy chunk hashes are outside the reviewed public chunk graph',async()=>{
 let changed=0;const{jobs}=await replay((url,body)=>{if(!url.includes('/runtime-main.'))return body;const next=body.replace('0f604c9fd55f9a067d63','11111111111111111111');if(next!==body)changed++;return next});assert.equal(changed,2);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('a narrowed public default filter prevents complete native global inventory',async()=>{
 let changed=0;await assert.rejects(replay((url,body)=>{if(!url.includes('/40.'))return body;const next=body.replace('Keyword:"",ClientIds:','Keyword:"India",ClientIds:');if(next!==body)changed++;return next}),/public|native|filter/i);assert.ok(changed>0)
})
test('an executable native role client under a hidden ancestor remains an explicit coverage gap',async()=>{
 await assert.rejects(replay((url,body)=>url===native?body+'<div hidden><script>fetch("/positions")</script></div>':body),/inline recruiting|native/i)
})
test('template and commented native role clients remain inert',async()=>{
 const{jobs}=await replay((url,body)=>url===native?body+'<template><script>fetch("/positions")</script></template><!--<script>fetch("/positions")</script>-->':body);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('an unused corporate client literal is not a native inventory gate',async()=>{
 let changed=0;const{jobs}=await replay((url,body)=>{if(!url.includes('0t0u76_jp6cfa.js'))return body;const next=body.replace('the passion to be a part of our remarkable story','the commitment to join our company');if(next!==body)changed++;return next});assert.equal(changed,2);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('unused corporate CSS does not veto unchanged public handoff semantics',async()=>{
 let changed=0;const{jobs}=await replay((url,body)=>{if(!url.endsWith('.css'))return body;changed++;return body+'\n.unused-marketing-modal{display:none!important;opacity:0}'});assert.ok(changed>0);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('a disabled public SearchJobs control cannot establish an active handoff',async()=>{await assert.rejects(replay((url,body)=>url===CAREERS_PAGE_URL?body.replace('<button class="btn">SEARCH JOBS</button>','<button class="btn" disabled>SEARCH JOBS</button>'):body),/handoff|disabled|SearchJobs|Alkem/i)})
test('overridden and redundant visible corporate CSS preserves effective public handoff',async()=>{
 const url='https://www.alkemlabs.com/_next/static/chunks/0u_05tjiy-gpf.css';const{jobs}=await replay((target,body)=>target===url?body+'\n.work-with-us .btn{display:none!important}.work-with-us .btn{display:inline-block!important}':body);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('a CSS has selector without matching descendants is unrelated to the public control',async()=>{
 const url='https://www.alkemlabs.com/_next/static/chunks/0u_05tjiy-gpf.css';const{jobs}=await replay((target,body)=>target===url?body+'\n.btn:has(.unused-private-child){display:none!important}':body);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('important hidden ancestors and source CSS variables cannot be overridden by a visible child',async()=>{
 const url='https://www.alkemlabs.com/_next/static/chunks/0u_05tjiy-gpf.css'
 for(const css of ['.work-with-us{display:none!important}.btn{display:inline-block!important}',':root{--public-control-display:none}.work-with-us .btn{display:var(--public-control-display)!important}',':root{--PublicControlDisplay:none}.work-with-us .btn{display:var(--PublicControlDisplay)!important}','button[CLASS~=btn]{display:none!important}'])await assert.rejects(replay((target,body)=>target===url?body+'\n'+css:body),/CSS visibility|public SearchJobs/i)
})

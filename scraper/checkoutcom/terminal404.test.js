import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {createCheckoutComScraper} from './script.js'
import {transport} from './native.fixtures.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const prefixes=['ar-ae','de-de','es-es','fr-fr','it-it','ja-jp','pt-pt','zh-cn']
const missing=prefixes.flatMap(p=>['jobs','early-careers',...(p==='ja-jp'?['careers']:[])].map(route=>`https://www.checkout.com/${p}/${route}`))
const current=new Map(['careers','jobs','early-careers'].map(p=>[`https://www.checkout.com/${p}`,readFileSync(new URL(`./fixtures/current-${p}-20261027.html`,import.meta.url),'utf8')]))
const first=missing[0]
function ioWith404(mutate=x=>x){
 const io=transport('checkoutcom'),original=io.fetchText
 io.fetchText=async url=>{
  if(current.has(url))return current.get(url)
  if(missing.includes(url)){
   const locale=new URL(url).pathname.split('/')[1],body=readFileSync(new URL(`./fixtures/terminal-404-${locale}-20261029.html`,import.meta.url),'utf8')
   const response=mutate({status:404,requestedUrl:url,responseUrl:url,body},url)
   throw Object.assign(Error('HTTP '+response.status+' for '+url),{status:response.status,publicResponse:response})
  }
  if(prefixes.some(p=>url===`https://www.checkout.com/${p}/careers`))return '<html><body>Checkout.com Careers</body></html>'
  return original(url)
 };return io
}
test('current first-party terminal404 routes reconcile while preserving all native role criteria and auditable opening/closing receipts',async()=>{
 let audit;const jobs=await createCheckoutComScraper().run({...ioWith404(),onNativeAudit:a=>{audit=a}})
 assert.equal(jobs.length,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(jobs[0].lifecycleCleanupAllowed,true)
 assert.equal(audit.fullDetailCount,1)
 assert.equal(audit.channelChecks.filter(c=>c.outcome==='verified-terminal-corporate-404').length,34)
 assert.ok(audit.channelChecks.filter(c=>c.outcome==='verified-terminal-corporate-404').every(c=>c.status===404&&c.requestedUrl===c.responseUrl&&c.sha256.length===64))
})
test('terminal404 proof cannot absorb error statuses, changed/blank/inert bodies, redirects or missing HTTP metadata',async()=>{
 for(const mutate of [r=>({...r,status:500}),r=>({...r,status:400}),r=>({...r,body:''}),r=>({...r,body:'<template>'+r.body+'</template>'}),r=>({...r,body:r.body+'<a href="https://jobs.lever.co/other">View open jobs</a>'}),r=>({...r,responseUrl:'https://foreign.example/404'}),r=>({...r,responseUrl:undefined})]){
  let audit;const jobs=await createCheckoutComScraper().run({...ioWith404((r,url)=>url===first?mutate(r):r),onNativeAudit:a=>{audit=a}})
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.ok(audit.unresolvedCorporateRoutes.includes(first))
 }
})
test('terminal404 qualification never absorbs access denial',async()=>{
 await assert.rejects(()=>createCheckoutComScraper().run(ioWith404(r=>({...r,status:403}))),/403/)
})
test('ordinary HTTP404 responses preserve complete native proof through the default production HTTP transport',async()=>{
 const originalFetch=globalThis.fetch,io=ioWith404();let audit
 globalThis.fetch=async(url,{signal}={})=>{
  signal?.throwIfAborted()
  try{const body=url.includes('/posting-api/')||url.includes('railway.app')?JSON.stringify(await io.fetchJson(url)):await io.fetchText(url);return{ok:true,status:200,url,text:async()=>body}}
  catch(error){if(!error.publicResponse)throw error;return{ok:false,status:error.status,url:error.publicResponse.responseUrl,text:async()=>error.publicResponse.body}}
 }
 try{const jobs=await createCheckoutComScraper().run({onNativeAudit:a=>{audit=a}});assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(audit.fullDetailCount,1);assert.equal(jobs[0].lifecycleCleanupAllowed,true)}finally{globalThis.fetch=originalFetch}
})

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,hasOfficialGmmcoCareersSignals} from './script.js'
import {currentGmmcoTransport} from './currentTransport20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-held-20261117.json.gz',import.meta.url))))
const body=p=>Buffer.from(p.bodyBase64,'base64').toString()
function replay(edit=(p,s)=>s){const reads=[];return{reads,options:{requestIntervalMs:0,fetchText:async()=>body(fixture.responses[0]),fetchImpl:async(url,init)=>{
 const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual current own declared handoff '+url);reads.push(String(url));assert.equal(init.redirect,'manual')
 return Object.defineProperty(new Response(edit(p,body(p)),{status:p.status,headers:p.headers}),'url',{value:p.url})
}}}}
test('Gmmco finite uppercase title follows actual native handoff but never invents an empty inventory from metadata shell',async()=>{
 assert.equal(hasOfficialGmmcoCareersSignals(body(fixture.responses[0])),true)
 const {reads,options}=replay()
 await assert.rejects(run(options),error=>error.failureKind==='source_inventory_unavailable'&&error.lifecycleCleanupAllowed===false
  &&error.nativeCollectionEvidence?.observedListingCount===null&&error.nativeCollectionEvidence?.retainedResponses.length===2)
 assert.equal(reads.length,2)
})
test('Gmmco current title variant cannot authorize inert/foreign handoff or unrelated native shell',async()=>{
 for(const mode of ['inert','foreign','native-title']){
  const {reads,options}=replay((p,s)=>{
   if(p.requestedURL.includes('www.gmmco.in')){
    if(mode==='inert')return s.replace(/<a([^>]*href="https:\/\/gmmco\.darwinbox\.in\/ms\/candidate\/careers"[^>]*)>([\s\S]*?)<\/a>/g,'<template><a$1>$2</a></template>')
    if(mode==='foreign')return s.replaceAll('https://gmmco.darwinbox.in/ms/candidate/careers','https://unrelated.invalid/careers')
   }else if(mode==='native-title')return s.replaceAll('Gmmco','Unrelated')
   return s
  })
  await assert.rejects(run(options),error=>error.failureKind==='parser_or_contract_error',mode)
  assert.ok(reads.length<3)
 }
})
test('Gmmco caller abort during timeout cleanup retains the exact opaque owner reason',async()=>{
 const c=new AbortController(),reason=Object.freeze({owner:'gmmco-during-cleanup'}),url='https://www.gmmco.in/about/careers'
 const io=currentGmmcoTransport({signal:c.signal,timeoutMs:10,requestIntervalMs:0,allowedURL:value=>value===url,
  fetchImpl:async()=>Object.defineProperty(new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{})}),{headers:{'content-type':'text/html'}}),'url',{value:url})})
 const timer=setTimeout(()=>c.abort(reason),40)
 try{await assert.rejects(io.read(url),error=>error===reason)}finally{clearTimeout(timer);io.close()}
})
test('Gmmco paced native reads preserve the exact caller reason without starting the next request',async()=>{
 const caller=new AbortController(),reason=Object.freeze({owner:'gmmco-pacing'}),url='https://www.gmmco.in/about/careers';let reads=0
 const io=currentGmmcoTransport({signal:caller.signal,requestIntervalMs:1000,allowedURL:value=>value===url,
  fetchImpl:async()=>{reads++;return Object.defineProperty(new Response('native',{headers:{'content-type':'text/html'}}),'url',{value:url})}})
 try{await io.read(url);const timer=setTimeout(()=>caller.abort(reason),20);try{await assert.rejects(io.read(url),error=>error===reason)}finally{clearTimeout(timer)}assert.equal(reads,1)}finally{io.close()}
})

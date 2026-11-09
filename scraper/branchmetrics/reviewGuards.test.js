import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {API_URL,parseListing,mergeListings,parseDetail} from './native.js'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-http-001.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(p=>[p.url,p.body])),now=new Date('2026-10-21T00:10:00Z')
test('failure aliases cannot certify an otherwise valid native zero',()=>{
 for(const fields of [{Error:'Server failure'},{Errors:['Unavailable']},{Success:false},{StatusCode:500},{success:'false'},{isError:'true'}]){
  assert.throws(()=>parseListing({items:[],page:0,pageSize:1000,totalItems:0,totalPages:0,...fields},0),JSON.stringify(fields))
 }
})
test('explicit hidden-only native descriptions remain missing content',()=>{
 const row=mergeListings(JSON.parse(packets.get(API_URL)).items).find(r=>r.locations.some(l=>l.countryCode==='IN')),html=packets.get(row.sourceUrl)
 for(const attribute of ['hidden','aria-hidden="true"','style="display:none"','style="visibility:hidden"']){
  const json=JSON.parse(html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)[1]),job=json.props.pageProps.apiData.jobPost
  job.description.role=`<div ${attribute}>${job.description.role}</div>`
  const changed=html.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)[\s\S]*?(<\/script>)/i,(_m,a,b)=>a+JSON.stringify(json).replace(/</g,'\\u003c')+b)
  const detail=parseDetail(changed,row,{now});assert.equal(detail.sourceDetailComplete,false,attribute);assert.equal(detail.jobDescription,'')
 }
})
test('caller abort interrupts a transport that never resolves and ignores its signal',async()=>{
 const controller=new AbortController(),operation=run({now,signal:controller.signal,fetchText:async()=>new Promise(()=>{})})
 const stop=setTimeout(()=>controller.abort(new Error('root caller abort')),10)
 let timeout
 try{await assert.rejects(Promise.race([operation,new Promise((_resolve,reject)=>{timeout=setTimeout(()=>reject(new Error('ignored abort timeout')),250)})]),/root caller abort/)}
 finally{clearTimeout(stop);clearTimeout(timeout)}
})
test('inert template closing tags cannot escape a real hidden description ancestor',()=>{
 const row=mergeListings(JSON.parse(packets.get(API_URL)).items).find(r=>r.locations.some(l=>l.countryCode==='IN')),html=packets.get(row.sourceUrl)
 for(const inert of ['<template><div></div></template>','<template></div></template>','<template><p></div></p></template>']){
  const json=JSON.parse(html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)[1]),job=json.props.pageProps.apiData.jobPost
  job.description.role=`<div hidden>${inert}${job.description.role}</div>`
  const changed=html.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)[\s\S]*?(<\/script>)/i,(_m,a,b)=>a+JSON.stringify(json).replace(/</g,'\\u003c')+b)
  const detail=parseDetail(changed,row,{now});assert.equal(detail.sourceDetailComplete,false,inert);assert.equal(detail.jobDescription,'')
 }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync}from'node:zlib'
import {createAlgonomyScraper,CAREERS_URL}from'./script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden}from'../../scraper-support/utils/inventoryEvidence.js'
const html=gunzipSync(fs.readFileSync(new URL('./test-data/current-parent-home-20261120.html.gz',import.meta.url))).toString('utf8')
const collect=(body=html,options={})=>{const calls=[];return{calls,pending:createAlgonomyScraper().run({fetchText:async url=>{calls.push(url);return{status:200,url:'https://adaglobal.com/',html:body}},...options})}}
test('actual Algonomy own redirect to the current parent homepage remains unknown without reading parent jobs or legacy ATS',async()=>{
 const io=collect(),jobs=await io.pending,e=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.deepEqual(io.calls,[CAREERS_URL]);assert.equal(e.listingComplete,false);assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.match(e.reason,/parent|Algonomy/i)
})
for(const[label,change]of[
 ['title',body=>body.replace('<title>ADA Global | The Data &amp; AI Experience Company</title>','<title>Other Publisher</title>')],
 ['canonical',body=>body.replace('<link rel="canonical" href="https://adaglobal.com/" />','<link rel="canonical" href="https://other.example/" />')],
 ['inert',body=>'<template>'+body+'</template>'],
 ['base',body=>body.replace('</head>','<base href="https://other.example/"></head>')],
])test('parent migration hold rejects a changed '+label+' authority',async()=>{
 await assert.rejects(collect(change(html)).pending,/Algonomy|parent|publisher/i)
})
test('a parent-looking document without final redirect metadata cannot establish the current migration',async()=>{
 await assert.rejects(createAlgonomyScraper().run({fetchText:async()=>html}),/Algonomy/)
})
test('current parent migration propagates exact opaque caller reason after a rejected read',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'opaque'})
 await assert.rejects(createAlgonomyScraper().run({signal:controller.signal,fetchText:async()=>{controller.abort(reason);throw Error('transport failed')}}),error=>error===reason)
})

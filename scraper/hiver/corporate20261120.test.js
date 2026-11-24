import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
const native=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-20261120.json.gz',import.meta.url))))
const CORPORATE='https://hiverhq.com/careers',BOARD='https://hiverhq.pinpointhq.com/'
const body=(p,fn)=>{p.bodyBase64=Buffer.from(fn(Buffer.from(p.bodyBase64,'base64').toString('utf8'))).toString('base64')}
async function replay(change=()=>{}){
 const counts=new Map(),calls=[]
 const jobs=await run({requestIntervalMs:0,now:()=>current.capturedAt,fetchImpl:async value=>{
  const url=String(value),visit=counts.get(url)??0;counts.set(url,visit+1)
  const original=url===CORPORATE?current.packet:(visit===0?native.opening:native.closing).find(p=>p.requestedURL===url)??native.assets.find(p=>p.requestedURL===url)
  assert.ok(original,'Only retained declared fixture endpoints')
  const packet=structuredClone(original);change(packet,url,visit);calls.push(url)
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 return{jobs,calls}
}
test('actual November20 corporate original admits its own exact native handoff in separately dated mixed native fixture',async()=>{
 const{jobs,calls}=await replay();assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(calls.length,24)
})
test('unrelated corporate comment, stylesheet and response trace metadata do not change declared employer handoff',async()=>{
 const{jobs}=await replay((p,u)=>{if(u===CORPORATE){p.headers['x-trace-metadata']='public-observation';body(p,h=>h.replace('</head>','<!-- publication cache refreshed --><style>.unrelated-decoration{color:blue}</style></head>').replace('</body>','<p>Our company builds modern customer service software.</p></body>'))}})
 assert.equal(jobs.length,1)
})
for(const[name,change]of[
 ['foreign canonical',p=>body(p,h=>h.replace('rel="canonical" href="'+CORPORATE+'"','rel="canonical" href="https://example.org/careers"'))],
 ['foreign recruitment target',p=>body(p,h=>h.replace('href="'+BOARD+'"','href="https://example.org/jobs"'))],
 ['inert recruitment declaration',p=>body(p,h=>h.replace(/<a\b[^>]*href="https:\/\/hiverhq\.pinpointhq\.com\/"[^>]*>[\s\S]*?<\/a>/,m=>'<template>'+m+'</template>'))],
 ['new corporate typed vacancies require review',p=>body(p,h=>h.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting","title":"Uninspected current corporate vacancy"}</script></head>'))],
 ['additional corporate hiring condition',p=>body(p,h=>h.replace('</body>','<p>Applicants must hold an additional certification.</p></body>'))],
 ['additional corporate div hiring condition',p=>body(p,h=>h.replace('</body>','<div>Applicants must hold an additional certification.</div></body>'))],
 ['corporate applications closed notice',p=>body(p,h=>h.replace('</body>','<p>We are no longer accepting applications.</p></body>'))],
 ['explicit corporate employer condition',p=>body(p,h=>h.replace('</body>','<p>The employer for this position is Example LLC.</p></body>'))],
 ['explicit corporate application cutoff',p=>body(p,h=>h.replace('</body>','<p>The last date for applying is 22 November 2026.</p></body>'))],
 ['corporate section with inline qualification',p=>body(p,h=>h.replace('</body>','<section>Applicants <span>must hold</span> an additional certification.</section></body>'))],
 ['current corporate handoff hidden by CSS',p=>body(p,h=>h.replace('</head>','<style>body{display:none}</style></head>'))],
 ['changed MIME',p=>{p.headers['content-type']='text/plain'}],
 ['partial entity presented with status200',p=>{p.headers['content-range']='bytes 0-100/999999'}],
])test('actual corporate handoff holds '+name,async()=>{await assert.rejects(replay((p,u)=>{if(u===CORPORATE)change(p)}),/Hiver current native:/)})

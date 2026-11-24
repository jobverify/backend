import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInitialHyperscienceCorporate} from '../scraper/hyperscience/currentProgrammeData.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/hyperscience-current-prefix-20261120.json.gz',import.meta.url))))
const sha=b=>createHash('sha256').update(b).digest('hex')
function packet(kind,edit=s=>s){const r=fixture.responses.find(r=>r.kind===kind),original=Buffer.from(r.bodyBase64,'base64');assert.equal(sha(original),r.receipt.sha256);assert.equal(original.length,r.receipt.bytes);const body=Buffer.from(edit(original.toString())),at=new Date().toISOString(),headers=structuredClone(r.receipt.headers);if(Object.hasOwn(headers,'content-length'))headers['content-length']=String(body.length);return{body,receipt:{requestedURL:r.receipt.requestedURL,finalURL:r.receipt.finalURL,status:200,headers,headerEntries:Object.entries(headers),method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',requestedAt:at,responseAt:at,completedAt:at,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length,discardedOverflowBytes:0,overflowBytes:0,bodyComplete:true,streamDone:true,decodedPrefixOnly:false,error:null}}}
const controls=[
 ['active closure','<p>Applications are closed.</p>'],
 ['nested closure','<p>Applications <em>are</em> closed.</p>'],
 ['hidden closure','<p hidden>Applications are closed.</p>'],
 ['template closure','<template><p>Applications are closed.</p></template>'],
 ['noscript closure','<noscript><p>Applications are closed.</p></noscript>'],
 ['parameterized JSON-LD','<script type="application/ld+json; charset=utf-8">{"@type":"JobPosting","title":"Unaccounted Engineer"}</script>'],
 ['uppercase JSON-LD','<script type="APPLICATION/LD+JSON; charset=UTF-8">{"@type":"JobPosting"}</script>'],
 ['graph JobPosting','<script type="application/ld+json">{"@graph":[{"@type":"JobPosting"}]}</script>'],
 ['type array','<script type="application/json">{"@type":["Thing","https://schema.org/JobPosting"]}</script>'],
 ['duplicate structured type','<script type="application/ld+json; charset=utf-8">{"@type":"JobPosting","@type":"Thing"}</script>'],
 ['escaped structured type','<script type="application/json">{"@type":"Job\\u0050osting"}</script>'],
 ['microdata','<div itemscope itemtype="https://schema.org/JobPosting"><span itemprop="title">Unaccounted Engineer</span></div>'],
 ['RDFa','<div vocab="https://schema.org/" typeof="JobPosting"><span property="title">Unaccounted Engineer</span></div>'],
 ['prefixed RDFa','<div prefix="s: https://schema.org/" typeof="s:JobPosting"></div>'],
 ['RDFa eligibility','<span property="applicantLocationRequirements">India</span>'],
 ['microdata criteria','<span itemprop="qualifications">Additional licence</span>'],
 ['relative openings iframe','<iframe src="/openings/india"></iframe>'],
 ['template iframe','<template><iframe src="/openings/india"></iframe></template>'],
 ['encoded srcdoc','<iframe srcdoc="&lt;a href=&quot;/openings/india&quot;&gt;Explore&lt;/a&gt;"></iframe>'],
 ['embedded object','<object data="/openings/india"></object>'],
 ['inert schema','<noscript><div itemscope itemtype="https://schema.org/JobPosting">Engineer</div></noscript>'],
 ['relative neutral recruitment link','<a href="/openings">Explore</a>'],
]
for(const kind of ['C0','C1']){
 test(kind+' current identity and17 known fragments survive MIME parameters and unrelated JSON telemetry',()=>{
  const model=readInitialHyperscienceCorporate(packet(kind,s=>s.replace('type="application/ld+json"','type="application/ld+json; charset=utf-8"')+'<script type="application/json">{"release":"unrelated-analytics-v2"}</script>'),kind)
  assert.equal(model.publication.publisherBrand,'Hyperscience');assert.equal(model.publication.rawGrammar.rawEntityRetained,true)
 })
 for(const[name,extra]of controls)test(kind+' refuses unreviewed '+name,async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('NO NETWORK'))
  assert.throws(()=>readInitialHyperscienceCorporate(packet(kind,s=>s+extra),kind),error=>error.code==='HYPERSCIENCE_PROGRAMME_HOLD')
 })
}

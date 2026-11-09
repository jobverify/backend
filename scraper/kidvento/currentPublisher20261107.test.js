import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import baselines from './native.scope.json' with {type:'json'}
import {verifyGoogleSitesPublisher} from './publisherChain.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-publisher.json.gz',import.meta.url))))
function replay(change=()=>{}){const rows=structuredClone(fixture);change(rows);const calls=[];return{rows,calls,request:async url=>{calls.push(url);const row=rows.find(r=>r.requestUrl===url);assert.ok(row,'unexpected publisher read '+url);return row.body}}}
test('current published Google Sites bridge and controller retain the typed Kidvento Keka handoff',async()=>{
 const{request,calls}=replay(),result=await verifyGoogleSitesPublisher(request,baselines.$publisher)
 assert.equal(result.nativeShell,'https://kidvento.keka.com/careers');assert.equal(result.websiteJavaScriptExecuted,false);assert.equal(calls.length,4)
})
test('registered Kidvento keeps full known native role criteria and its partial scope through the current publisher',async()=>{
 const old=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261030.json.gz',import.meta.url)))).records
 const rows=[...fixture,...old.filter(r=>!fixture.some(c=>c.requestUrl===r.url))],calls=[]
 const jobs=await createCatalogScraper(getScraperCatalog().find(r=>r.source==='kidvento')).run({fetchImpl:async url=>{
  calls.push(url);const row=rows.find(r=>(r.requestUrl||r.url)===url);assert.ok(row,'unexpected native read '+url)
  const response=new Response(row.body,{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.requestUrl||row.responseUrl||row.finalUrl});return response
 }})
 assert.equal(jobs.length,29);assert.equal(jobs.filter(r=>r.sourceDetailComplete).length,17)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.ok(jobs.every(r=>r.lifecycleCleanupAllowed===false))
 assert.equal(calls.filter(url=>url.includes('/jobdetails/')).length,70)
})
test('an unreviewed Google Sites controller cannot activate the Kidvento native board',async()=>{
 const{request}=replay(rows=>{rows.find(r=>r.requestUrl.endsWith('/m=N0NZx')).body+=';fetch("https://foreign.example/jobs")'})
 await assert.rejects(verifyGoogleSitesPublisher(request,baselines.$publisher),/program|bytes|changed/)
})
test('Kidvento publisher rejects foreign embed identity and inactive bridge frames',async()=>{
 for(const mutate of [html=>html.replaceAll('data-url="https://kidvento.keka.com/careers"','data-url="https://foreign.keka.com/careers"'),html=>html.replace(/<iframe\b[^>]*jsname="WMhH6e"[^>]*>[\s\S]*?<\/iframe>/,'<template>$&</template>')]){
  const{request,calls}=replay(rows=>{rows[0].body=mutate(rows[0].body)})
  await assert.rejects(verifyGoogleSitesPublisher(request,baselines.$publisher),/embed|frame|bridge/);assert.equal(calls.length,1)
 }
})
test('Kidvento publisher requires active classic base and nonce-matched GAPI scripts',async()=>{
 for(const mutate of [html=>html.replace('id="base-js"','type="application/json" id="base-js"'),html=>html.replace(/(<script\b[^>]*src="https:\/\/apis\.google\.com\/js\/client\.js\?onload=gapiLoaded"[^>]*nonce=")[^"]+/, '$1different')]){
  const{request,calls}=replay(rows=>{rows[0].body=mutate(rows[0].body)})
  await assert.rejects(verifyGoogleSitesPublisher(request,baselines.$publisher),/classic|GAPI|client|bootstrap/);assert.equal(calls.length,1)
 }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {CAREERS,faireAssets,faireBindings,runNativeFaire} from './native.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-http-20261110.json.gz',import.meta.url))))
const records=new Map(capture.responses.map(row=>[row.url,row]))
const sharedURL='https://cdn.faire.com/visitor/_next/static/chunks/18522-c5ef1c4b96b1bf13.js'
const pageURL='https://cdn.faire.com/visitor/_next/static/chunks/app/(app)/visitor/%5Blocale%5D/(pagesWithModal)/(noHeader)/careers/openings/page-06eb1b6ca8669f22.js'
const employeeURL='https://boards-api.greenhouse.io/v1/boards/faire/jobs?content=true'
const consultantURL='https://boards-api.greenhouse.io/v1/boards/faireconsultants/jobs?content=true'
const html=records.get(CAREERS).body,page=records.get(pageURL).body,shared=records.get(sharedURL).body
const sha=value=>createHash('sha256').update(value).digest('hex')
const transport=(override=(row)=>row,requested=[])=>async(url,{signal})=>{
 signal.throwIfAborted();requested.push(url)
 assert.ok(records.has(url),'Only currently captured corporate-declared resources may be requested: '+url)
 const row=override(structuredClone(records.get(url)),url)
 return {url:row.finalUrl,status:row.status,headers:row.headers,body:Buffer.from(row.body),bodyComplete:true}
}
const editJSON=(row,edit)=>{const payload=JSON.parse(row.body);edit(payload);return {...row,body:JSON.stringify(payload)}}

// Pinning the retired chunk 43927 must break this test. The current advertised
// 18522 module still owns the imported employee/consultant API data flow.
test('Faire current advertised modules bind the real employee and consultant inventories',()=>{
 assert.equal(capture.responses.length,5)
 for(const row of capture.responses){assert.equal(sha(row.body),row.sha256);assert.equal(Buffer.byteLength(row.body),row.bytes)}
 const assets=faireAssets(html)
 assert.deepEqual(assets,{page:pageURL,shared:sharedURL})
 const bindings=faireBindings(page,shared,assets)
 assert.deepEqual(bindings.map(row=>[row.nativeWorkType,row.boardToken]),[['EMPLOYMENT','faire'],['CONSULTANT','faireconsultants']])
 assert.deepEqual(bindings.map(row=>row.bindingEvidence.matchedLinks),[
  ['https://boards-api.greenhouse.io/v1/boards/faire/departments'],
  ['https://boards-api.greenhouse.io/v1/boards/faireconsultants/departments'],
 ])
 assert.ok(bindings.every(row=>row.bindingEvidence.verified===true&&row.bindingEvidence.evidenceURL===sharedURL))
})

test('Faire registered source reads both genuine current feeds without promoting absent India matches to a verified zero',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected live network in current Faire replay')})
 const employee=JSON.parse(records.get(employeeURL).body),consultants=JSON.parse(records.get(consultantURL).body)
 assert.equal(employee.meta.total,68);assert.equal(employee.jobs.length,68)
 assert.equal(consultants.meta.total,0);assert.deepEqual(consultants.jobs,[])
 assert.ok(employee.jobs.every(row=>row.company_name==='Faire'&&typeof row.content==='string'&&row.content.length>1000))
 const requested=[],provider=getScraperCatalog().find(row=>row.source==='faire')
 const jobs=await createCatalogScraper(provider).run({transport:transport(undefined,requested)})
 assert.equal(jobs.length,0)
 assert.equal(requested.length,5);assert.deepEqual(new Set(requested),new Set([CAREERS,pageURL,sharedURL,employeeURL,consultantURL]))
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'discovery-only');assert.equal(evidence.firstParty,true)
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
})

test('Faire ignores dormant reviewed chunks and rejects ambiguous or detached active module declarations',()=>{
 const retired='https://cdn.faire.com/visitor/_next/static/chunks/43927-0000000000000000.js'
 assert.deepEqual(faireAssets(html+'<template><script src="'+retired+'"></script></template>'),{page:pageURL,shared:sharedURL})
 assert.throws(()=>faireAssets(html+'<script src="'+retired+'"></script>'),/shared careers module/)
 assert.throws(()=>faireAssets(html.replaceAll(sharedURL,'https://unrelated.invalid/18522-c5ef1c4b96b1bf13.js')),/shared careers module/)
 const hidden=html.replaceAll('src="'+sharedURL+'"','type="application/json" src="'+sharedURL+'"')
 assert.notEqual(hidden,html);assert.throws(()=>faireAssets(hidden),/shared careers module/)
})

for(const[name,original,changed,error]of[
 ['a disconnected imported inventory hook',page,page.replace('S=r(931807)','S=r(931808)'),/inventory hook/],
 ['a missing consultant scope',shared,shared.replace('n.CY.CONSULTANT','n.CY.EMPLOYMENT'),/inventory hook/],
 ['a changed native method',shared,shared.replace('method:"GET",withCredentials:!1','method:"POST",withCredentials:!1'),/GET data flow/],
 ['a credentialed request',shared,shared.replace('method:"GET",withCredentials:!1','method:"GET",withCredentials:!0'),/GET data flow/],
 ['an unrelated API host',shared,shared.replace('baseUrl:"https://boards-api.greenhouse.io"','baseUrl:"https://unrelated.invalid"'),/GET data flow/],
 ['a different route index',shared,shared.replace('url:A[e],route:A[e]','url:A[e],route:A[other]'),/GET data flow/],
])test('Faire keeps '+name+' closed after accepting the current module layout',()=>{
 assert.notEqual(changed,original,'The fault must change the original current module')
 assert.throws(()=>faireBindings(original===page?changed:page,original===shared?changed:shared,{page:pageURL,shared:sharedURL}),error)
})

test('Faire does not accept an employer mismatch or incomplete native feed as a zero inventory',async()=>{
 await assert.rejects(()=>runNativeFaire({transport:transport((row,url)=>url===employeeURL?editJSON(row,payload=>{payload.jobs[0].company_name='Unrelated Employer'}):row)}),/employer label mismatch/)
 await assert.rejects(()=>runNativeFaire({transport:transport((row,url)=>url===employeeURL?editJSON(row,payload=>{payload.meta.total++}):row)}),/Incomplete greenhouse inventory/)
 await assert.rejects(()=>runNativeFaire({transport:transport((row,url)=>url===consultantURL?{...row,status:503}:row)}),/HTTP 503/)
})

test('Faire rejects duplicate native identities and a changed public resource URL',async()=>{
 await assert.rejects(()=>runNativeFaire({transport:transport((row,url)=>url===employeeURL?editJSON(row,payload=>{payload.jobs[1].id=payload.jobs[0].id}):row)}),/duplicate native identity/)
 await assert.rejects(()=>runNativeFaire({transport:transport((row,url)=>url===sharedURL?{...row,finalUrl:pageURL}:row)}),/response incomplete/)
})

test('Faire pre-cancelled current collection makes no requests',async()=>{
 const controller=new AbortController();controller.abort(Error('cancel current Faire source'))
 await assert.rejects(()=>runNativeFaire({signal:controller.signal,transport:async()=>assert.fail('Cancelled source made a request')}),/cancel current Faire/)
})

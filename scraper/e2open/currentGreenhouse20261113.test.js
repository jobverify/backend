import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {pageShowsNoPublicJobs} from './script.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-native.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(packet=>[packet.requestedURL,packet]))
for(const packet of fixture.packets){const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(bytes.length,packet.bodyBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)}
const careers='https://www.e2open.com/company/careers/',jobsPage='https://www.e2open.com/jobs/',client='https://www.e2open.com/sb/e2open-js.v170.js'
const api='https://boards-api.greenhouse.io/v1/boards/e2openllc/',role='https://job-boards.eu.greenhouse.io/e2openllc/jobs/4136117101'
const body=url=>Buffer.from(packets.get(url).bodyBase64,'base64').toString('utf8')
const registered=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='e2open'))
function replay(change=(text)=>text){const calls=[],seen=new Map();return{calls,options:{now:()=>fixture.capturedAt,fetchText:async(url,options)=>{
 calls.push({url,signal:options?.signal});assert.ok(packets.has(url),'only current declared native GETs '+url)
 const index=seen.get(url)||0;seen.set(url,index+1);return change(body(url),url,index)
}}}}
function remix(html,change){const match=html.match(/window\.__remixContext = (\{[\s\S]*?\});<\/script>/);assert.ok(match);const value=JSON.parse(match[1]);change(value.state.loaderData['routes/$url_token_.jobs_.$job_post_id']);const literal=JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');return html.replace(match[0],'window.__remixContext = '+literal+';</script>')}

test('actual hidden e2open no-data placeholder cannot certify an empty public board',()=>{
 assert.equal(pageShowsNoPublicJobs(body(jobsPage)),false)
})
test('registered current e2open follows the declared native client and preserves its sole prospect record',async()=>{
 const {calls,options}=replay(),jobs=await registered().run(options)
 assert.equal(calls.length,14);assert.equal(jobs.length,0)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.sourceNativeRaw.length,1);assert.equal(audit.sourceNativeDepartments.departments.length,10)
 assert.equal(audit.sourceNativeOffices.offices.length,5);assert.equal(audit.renderedNativeIds.length,0)
 const record=audit.observations[0]
 assert.equal(record.nativeSourceRecord.id,4136117101);assert.equal(record.nativeDetailRecord.jobPost.post_type,'prospect_post')
 assert.equal(record.vacancy,false);assert.equal(record.fullNativeCriteriaVisible,true);assert.equal(record.activeApplication,true)
 assert.match(record.nativeDetailRecord.jobPost.content,/considered generally/)
 assert.equal(record.nativeDetailRecord.jobPost.questions.length,9)
 assert.equal(record.nativeOpeningDetailHTML,body(role));assert.equal(record.nativeClosingDetailHTML,body(role))
 assert.equal(readSourceObservationEvidence(jobs,'e2open').recordKind,'hiring-signals')
 assert.equal(readSourceObservationEvidence(jobs,'e2open').observedRecordCount,1)
 assert.equal(readSourceObservationEvidence(jobs,'e2open').observedVacancyCount,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('an unreviewed e2open publisher program cannot activate any native API',async()=>{
 const {calls,options}=replay((text,url)=>url===client?text+';fetch("https://foreign.example/jobs")':text)
 await assert.rejects(registered().run(options),/client program/)
 assert.equal(calls.some(call=>call.url.startsWith(api)),false)
})
for(const kind of ['foreign','inert','non-executable'])test('e2open rejects a '+kind+' declared native client',async()=>{
 const {options}=replay((text,url)=>url===jobsPage?kind==='foreign'?text.replace('/sb/e2open-js.v170.js','https://foreign.example/sb/e2open-js.v170.js')
  :text.replace(/<script\b[^>]*src="\/sb\/e2open-js\.v170\.js"[^>]*><\/script>/,match=>kind==='inert'?'<template>'+match+'</template>':match.replace('<script','<script type="application/json"')):text)
 await assert.rejects(registered().run(options),/handoff|client/)
})
for(const bothPages of [false,true])test('a retired current e2open handoff on '+(bothPages?'both pages':'jobs page')+' cannot fall through to historical JSON-LD vacancy extraction',async()=>{
 const stale={"@context":"https://schema.org","@type":"JobPosting",title:'Stale synthetic historical vacancy',description:'Historical public markup cannot establish a current opening or active application.',identifier:{value:'stale-1'},hiringOrganization:{name:'e2open'},jobLocation:{address:{addressCountry:'India',addressLocality:'Bengaluru'}},url:'https://www.e2open.com/jobs/stale-1/'}
 const retire=text=>text.replace('id="page-block-greenhouse"','id="retired-board"').replace(/<script\b[^>]*src="\/sb\/e2open-js\.v170\.js"[^>]*><\/script>/,'')
 const {options}=replay((text,url)=>url===jobsPage?retire(text).replace('</head>','<script type="application/ld+json">'+JSON.stringify(stale)+'</script></head>'):bothPages&&url===careers?retire(text):text)
 await assert.rejects(registered().run(options),/handoff|client/)
})
test('e2open cannot silently truncate the native jobs inventory',async()=>{
 const {options}=replay((text,url)=>{if(url!==api+'jobs')return text;const value=JSON.parse(text);value.meta.total++;return JSON.stringify(value)})
 await assert.rejects(registered().run(options),/pagination|total/)
})
test('e2open rejects an unbound department vacancy even when every top-level native record remains unchanged',async()=>{
 const {options}=replay((text,url)=>{if(url!==api+'departments?render_as=tree')return text;const value=JSON.parse(text);value.departments[0].jobs.push({...JSON.parse(body(api+'jobs')).jobs[0],id:9999999999});return JSON.stringify(value)})
 await assert.rejects(registered().run(options),/department|membership|identity/)
})
test('e2open requires matching whole closing native records',async()=>{
 const {options}=replay((text,url,index)=>{if(url!==api+'jobs'||index===0)return text;const value=JSON.parse(text);value.jobs[0].title='Changed native talent pool';return JSON.stringify(value)})
 await assert.rejects(registered().run(options),/closing/)
})
for(const kind of ['offscreen','raw-script'])test('e2open preserves but does not fully qualify '+kind+' authored native criteria',async()=>{
 const {options}=replay((text,url)=>{
  if(url!==role)return text
  const original=JSON.parse(text.match(/window\.__remixContext = (\{[\s\S]*?\});<\/script>/)[1]).state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost.content
  const addition=kind==='offscreen'?'<span style="position:fixed;left:-9999px">Mandatory clearance.</span>':'<script type="application/json">Mandatory clearance.</script>'
  const updated=original.replace('</p>',addition+'</p>')
  return remix(text.replace(original,updated),value=>{value.jobPost.content=updated})
 })
 const jobs=await registered().run(options),record=jobs.nativeCollectionEvidence.observations[0]
 assert.equal(jobs.length,0);assert.equal(record.fullNativeCriteriaVisible,false)
 assert.match(record.nativeDetailRecord.jobPost.content,/Mandatory clearance/)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('e2open does not accept a retired native application as an active source record',async()=>{
 const {options}=replay((text,url)=>url===role?remix(text,value=>{value.jobPost.redirect_to='https://foreign.example/retired'}):text)
 const jobs=await registered().run(options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations[0].activeApplication,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('empty configured e2open feeds retain unknown company scope and cannot authorize cleanup',async()=>{
 const {options}=replay((text,url)=>url===api+'jobs'?JSON.stringify({jobs:[],meta:{total:0}}):text)
 const jobs=await registered().run(options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'e2open').sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('e2open cancellation from a public reader stops before the next source request',async()=>{
 const controller=new AbortController(),reason={cancel:'e2open'},calls=[]
 await assert.rejects(registered().run({signal:controller.signal,fetchText:async(url)=>{calls.push(url);controller.abort(reason);return body(careers)}}),error=>error===reason)
 assert.deepEqual(calls,[careers])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {run} from './script.js'
import {CAREERS_URL,CURRENT_JOBS_URL,LISTING_API_URL,TENANT_URL} from './nativeInventory.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261128/current-handoff.json.gz',import.meta.url))))
const native=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261125/current-native.json.gz',import.meta.url))))
const component='https://www.licious.in/_next/static/chunks/app/content/careers/jobs/page-81b2f24a33224a19.js'
const prefix=new Map(fixture.prefix.map(row=>[row.requestedUrl,row])),sha=value=>createHash('sha256').update(value).digest('hex')
const provider=getScraperCatalog().find(row=>row.source==='licious')
const replay=(edit=()=>{})=>{
 const reads=[],counts=new Map()
 return{reads,fetchPage:async(url,init)=>{
  init.signal?.throwIfAborted();const method=init.method??'GET',body=init.body??null;reads.push({url,method,body})
  assert.equal(method,body==null?'GET':'POST')
  const actual=prefix.get(url);let response
  if(actual){assert.equal(method,'GET');assert.equal(body,null);assert.equal(sha(actual.body),actual.sha256);response={url:actual.url,status:actual.status,body:actual.body}}
  else{
   const key=JSON.stringify([url,method,body]),index=counts.get(key)??0;counts.set(key,index+1)
   const row=native.responses.filter(packet=>packet.requestedURL===url&&packet.method===method&&packet.requestBody===body)[index]
   assert.ok(row,'Only retained actual native public query '+key+' #'+index)
   const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(sha(bytes),row.sha256)
   response={url:row.responseURL,status:row.status,contentType:row.headers['content-type'],body:bytes.toString()}
  }
  return edit({url,init,response,reads})??response
 }}
}
const modules=code=>{
 const ast=parse(code,{ecmaVersion:'latest'}),rows=new Map()
 const walk=node=>{if(!node||typeof node!=='object')return
  if(node.type==='Property'&&typeof node.key?.value==='number'&&/FunctionExpression|ArrowFunctionExpression/.test(node.value?.type??'')){assert.equal(rows.has(node.key.value),false);rows.set(node.key.value,code.slice(node.value.start,node.value.end))}
  for(const value of Object.values(node))for(const child of Array.isArray(value)?value:[value])if(child&&typeof child.type==='string')walk(child)
 }
 walk(ast);return rows
}

test('three genuine current corporate/component originals retain exact body identity and explicit provenance',()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.validCurrentCheck,false);assert.equal(fixture.publisherProgramsExecuted,false);assert.equal(prefix.size,3)
 assert.deepEqual([...prefix.keys()],[CAREERS_URL,CURRENT_JOBS_URL,component])
 for(const row of fixture.prefix){assert.equal(sha(row.body),row.sha256);assert.equal(row.status,200);assert.equal(row.method,'GET');assert.equal(row.requestBody,null)}
 assert.equal(prefix.get(component).sha256,'4a9de32ef85d53a776b5a9d9bd43d0b1dc37aa69f80ea13dc28668fa612f17e1')
})

test('all six non-bootstrap current modules preserve complete previous bodies including the entire native iframe initializer',()=>{
 const current=modules(prefix.get(component).body),prior=modules(Buffer.from(fixture.priorComponent.bodyBase64,'base64').toString())
 assert.deepEqual([...current.keys()],[4853,28708,29001,31007,41402,68321,89173]);assert.deepEqual([...prior.keys()],[4853,28708,29001,31007,41402,47917,68321])
 for(const id of[4853,28708,29001,31007,41402,68321])assert.equal(current.get(id),prior.get(id))
 assert.equal(sha(current.get(28708)),'afb698be705c111987565525136b6369934898a87a34420e5c507b56dfb9aeeb')
 assert.ok(current.get(28708).includes('window.mnh_ci_onreadystatechange("careers","licious")'))
 assert.ok(current.get(28708).includes('https://licious.mynexthire.com/employer/ui/js/jobboard/careers-integration.js'))
 assert.ok(current.get(28708).includes('"/employer/jobs/careers#"'))
 assert.ok(current.get(89173).includes('Promise.resolve().then(r.bind(r,28708))'))
 assert.ok(prefix.get(component).body.endsWith('()=>e(e.s=89173)),_N_E=e.O()}]);'))
})

test('the exact current declared component reaches only the previously reviewed integration client',async()=>{
 const source=replay(({url})=>{if(url.endsWith('/careers-integration.js'))throw Error('Reached exact reviewed integration GET')})
 await assert.rejects(run(source),/Reached exact reviewed integration GET/)
 assert.equal(source.reads.length,4);assert.equal(source.reads[2].url,component);assert.equal(source.reads.some(row=>row.url===LISTING_API_URL),false)
})

test('labeled current-handoff plus genuine historical native replay preserves all35raw models without country or complete company claims',async()=>{
 const source=replay(),jobs=await run(source),audit=jobs.nativeCollectionEvidence,assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(source.reads.length,47);assert.equal(jobs.length,0);assert.equal(audit.observations.length,35);assert.equal(audit.closingRecords.length,35)
 assert.deepEqual(audit.observations.map(row=>row.listingRecord),audit.closingRecords);assert.ok(audit.observations.every(row=>row.listingRecord&&row.detailRecord))
 assert.equal(audit.reasons.filter(reason=>reason.startsWith('native-role-country-unpublished:')).length,33)
 assert.ok(audit.reasons.includes('full-native-description-unavailable:1617'));assert.ok(audit.reasons.includes('role-employer-scope-unresolved:1557'));assert.ok(audit.reasons.includes('app-router-company-scope-unqualified'))
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.partial,true);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

for(const[name,change]of[
 ['tenant initializer',body=>body.replace('"careers","licious"','"careers","foreign"')],
 ['runtime bootstrap binding',body=>body.replace('e.s=89173','e.s=89174')],
 ['component bootstrap consumer',body=>body.replace('Promise.resolve().then(r.bind(r,28708))','Promise.resolve().then(r.bind(r,28709))')],
 ['additional whole programme',body=>body+';globalThis.unknownRecruitment=true'],
])test('whole current component '+name+' change rejects before integration or native data reads',async()=>{
 const source=replay(({url,response})=>{if(url!==component)return;const body=change(response.body);assert.notEqual(body,response.body);return{...response,body}})
 await assert.rejects(run(source),/current job client contract changed/)
 assert.equal(source.reads.length,3);assert.equal(source.reads.some(row=>row.url===LISTING_API_URL),false)
})

for(const[name,change]of[
 ['unknown component',body=>body.replaceAll('page-81b2f24a33224a19.js','page-0000000000000000.js')],
 ['foreign component',body=>body.replace('src="/_next/static/chunks/app/content/careers/jobs/page-81b2f24a33224a19.js"','src="https://other.example/_next/static/chunks/app/content/careers/jobs/page-81b2f24a33224a19.js"')],
 ['extra hidden carrier',body=>body.replace('</body>','<div hidden><script src="/_next/static/chunks/app/content/careers/jobs/page-2222222222222222.js"></script></div></body>')],
 ['forged legacy carrier',body=>body.replace('</body>','<template><script id="__NEXT_DATA__" type="application/json">{"page":"/content/careers/jobs"}</script></template></body>')],
 ['changed section ownership',body=>body.replace('aria-labelledby="careers-jobs-title"','aria-labelledby="other-title"')],
 ['foreign iframe employer',body=>body.replace('id="mnhembedded"','id="mnhembedded" src="https://other.mynexthire.com/employer/jobs/careers"')],
 ['srcdoc iframe',body=>body.replace('id="mnhembedded"','id="mnhembedded" srcdoc="<p>Unknown role conditions</p>"')],
])test('current '+name+' cannot authorize this native handoff',async()=>{
 const source=replay(({url,response})=>{if(url!==CURRENT_JOBS_URL)return;const body=change(response.body);assert.notEqual(body,response.body);return{...response,body}})
 await assert.rejects(run(source),/current .*?(?:handoff|carrier|binding)/);assert.equal(source.reads.length,2);assert.equal(source.reads.some(row=>row.url===LISTING_API_URL),false)
})

test('current corporate client does not waive a foreign native tenant identity',async()=>{
 const source=replay(({url,response})=>{
  if(url!==TENANT_URL)return
  const payload=JSON.parse(response.body);payload.clientName='Other Employer';return{...response,body:JSON.stringify(payload)}
 })
 await assert.rejects(run(source),/employer identity/);assert.equal(source.reads.some(row=>row.url===LISTING_API_URL),false)
})

test('foreign native role countries remain raw observations with explicit country conflict reasons',async()=>{
 const source=replay(({url,response})=>{
  if(url!==LISTING_API_URL&&!url.endsWith('/requisition/object'))return
  const payload=JSON.parse(response.body),rows=payload.reqDetailsBOList??[payload.data.reqDetailsBO]
  for(const row of rows)row.countryCode='US'
  return{...response,body:JSON.stringify(payload)}
 })
 const jobs=await run(source),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(audit.observations.length,35);assert.ok(audit.reasons.some(reason=>reason.startsWith('native-country-scope-conflicts:')))
 assert.ok(audit.observations.every(row=>row.listingRecord.countryCode==='US'&&row.detailRecord.countryCode==='US'));assert.equal(audit.lifecycleCleanupAllowed,false)
})

test('the genuine clean registered46response capture retains all34raw native models and operational blocked-zero holds',async()=>{
 const actual=fixture.finalRegistered,packets=actual.packets;let offset=0
 assert.equal(packets.length,46);assert.equal(actual.outcome.captureBytes,928868);assert.equal(actual.outcome.captureFinalization.drained,true);assert.equal(actual.outcome.captureFinalization.pendingAtFreeze,0)
 for(const[file,hash]of Object.entries(actual.outcome.sourceCodeHashes))assert.equal(sha(readFileSync(new URL('./'+file,import.meta.url))),hash)
 for(const row of packets){assert.equal(sha(row.body),row.sha256);assert.equal(row.status,200)}
 const jobs=await run({fetchPage:async(url,init)=>{
  const row=packets[offset++];assert.ok(row);assert.equal(url,row.requestedUrl);assert.equal(init.method,row.method);assert.equal(init.body??null,row.requestBody)
  return{url:row.url,status:row.status,contentType:row.headers['content-type'],body:row.body}
 }})
 const audit=jobs.nativeCollectionEvidence,assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(offset,46);assert.equal(jobs.length,0);assert.equal(audit.observations.length,34);assert.equal(audit.closingRecords.length,34)
 assert.deepEqual(audit.closingRecords,actual.closingRecords);assert.deepEqual(audit.observations.map(row=>row.listingRecord),audit.closingRecords);assert.deepEqual(audit.reasons,actual.reasons)
 for(const observation of audit.observations){
  const saved=actual.summaries.find(row=>row.reqId===observation.listingRecord.reqId);assert.ok(saved);assert.ok(observation.detailRecord)
  assert.equal(sha(JSON.stringify(observation.listingRecord)),saved.listingRecordSHA256);assert.equal(sha(JSON.stringify(observation.detailRecord)),saved.detailRecordSHA256);assert.equal(sha(observation.detailRecord.jdDisplay),saved.rawCriteriaSHA256)
 }
 assert.equal(audit.reasons.filter(reason=>reason.startsWith('native-role-country-unpublished:')).length,33);assert.ok(audit.reasons.includes('role-employer-scope-unresolved:1557'));assert.equal(audit.reasons.some(reason=>reason.startsWith('native-detail-unavailable:')),false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(assessment.runnerOutcome.rawRecords,34);assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.zeroJobEvidence,'blocked-zero');assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.partial,true);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

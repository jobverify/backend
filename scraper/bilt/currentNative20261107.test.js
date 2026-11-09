import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createBiltReader,HOME,FEED} from './nativeTransport.js'
import {readBiltRSS} from './nativeModels.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/original-http.json.gz',import.meta.url))))
const originals=new Map(fixture.records.map(row=>{
 const body=Buffer.from(row.bodyBase64,'base64')
 assert.equal(body.length,row.bytes)
 assert.equal(createHash('sha256').update(body).digest('hex'),row.sha256)
 return [row.requestedURL,{url:row.finalURL,status:row.status,contentType:row.contentType,html:new TextDecoder('utf-8',{fatal:true}).decode(body)}]
}))
globalThis.fetch=()=>{throw Error('Network forbidden in Bilt original-body regression')}

test('Bilt declared RSS retains four explicit foreign vacancy observations without certifying India zero',async()=>{
 const calls=[]
 const jobs=await run({requestIntervalMs:0,fetchPage:async url=>{assert.ok(originals.has(url),'Only original declared URLs');calls.push(url);return structuredClone(originals.get(url))},now:()=> '2026-11-06T21:32:58.153Z'})
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'bilt')?.observedVacancyCount,4)
 assert.equal(readSourceObservationEvidence(jobs,'bilt')?.companyIndiaTotal,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(jobs.sourceAudit.fullServerPublishedNativeModels,4)
 assert.equal(jobs.sourceAudit.heldRoles.length,0)
 assert.equal(calls.length,18)
 assert.deepEqual(jobs.sourceAudit.observations.map(role=>[role.id,role.country,role.postingDate,role.workplaceType]),[
  ['27786539','United States','2026-10-02',null],['27786534','United States','2026-10-02','Hybrid'],
  ['27784648','United States','2026-09-04',null],['27782644','United States','2026-08-05',null]])
 for(const role of jobs.sourceAudit.observations){
  const schema=JSON.parse(readNativeDocument(originals.get(role.url).html).nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json')[0].raw)
  assert.deepEqual(role.schema,schema);assert.equal(role.fullCriteriaHTML,schema.description)
  assert.deepEqual(role.sourceNativeEmployer,schema.hiringOrganization)
  assert.ok(role.fullCriteriaText.length>4000)
  assert.equal(role.applicationAcceptanceVerified,false)
  assert.equal(role.clientProof.externalProgramBodiesReviewed,false)
 }
 assert.ok(calls.every(url=>originals.has(url)))
 // This fixture has opening responses only. Reusing them in a controlled
 // closing phase never constitutes a fresh or complete company inventory.
 assert.match(fixture.qualification,/reuses original opening bodies/)
})

const reply=(url,body='<html></html>',status=200,mime='text/html')=>{
 const response=new Response(body,{status,headers:{'content-type':mime}})
 Object.defineProperty(response,'url',{value:url});return response
}
test('Bilt transport accepts actual XML MIME only on its exact declared feed',async()=>{
 for(const [url,mime,allowed]of [[FEED,'text/xml;charset=UTF-8',true],[FEED,'application/rss+xml',true],[HOME,'text/xml',false],[FEED,'text/html',false]]){
  const reader=createBiltReader({requestIntervalMs:0,fetchImpl:async(value,init)=>{assert.equal(value,url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');return reply(url,'<rss/>',200,mime)}})
  try{if(allowed)assert.equal((await reader.read(url)).contentType,mime);else await assert.rejects(reader.read(url),/MIME/)}finally{reader.close()}
 }
})
test('Bilt reader preserves genuine denial status and original denied entity',async()=>{
 const reader=createBiltReader({requestIntervalMs:0,fetchImpl:async url=>reply(url,'Access Denied',403)})
 try{await assert.rejects(reader.read(HOME),error=>error.status===403&&error.failureKind==='blocked_or_access_denied');assert.equal(reader.receipts.length,1);assert.equal(Buffer.from(reader.receipts[0].bodyBase64,'base64').toString(),'Access Denied');await assert.rejects(reader.read(HOME),/cap|Unbound/)}finally{reader.close()}
})
test('Bilt denied stream keeps primary403 when the original body cannot be completed',async()=>{
 const reader=createBiltReader({requestIntervalMs:0,fetchImpl:async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read(){throw Error('original stream failed')},cancel(){return new Promise(()=>{})},releaseLock(){}}}}})})
 try{await assert.rejects(reader.read(HOME),error=>error.status===403&&error.cause?.message==='original stream failed');assert.equal(reader.receipts[0].status,403);assert.equal(reader.receipts[0].bodyComplete,false)}finally{reader.close()}
})
test('Bilt cancellation retains the exact frozen opaque caller reason',async()=>{
 const reason=Object.freeze({caller:'opaque'}),caller=new AbortController();let started
 const entered=new Promise(resolve=>{started=resolve})
 const reader=createBiltReader({signal:caller.signal,requestIntervalMs:0,fetchImpl:async()=>{started();return new Promise(()=>{})}})
 try{const pending=reader.read(HOME);await entered;caller.abort(reason);await assert.rejects(pending,error=>error===reason);assert.deepEqual(reason,{caller:'opaque'})}finally{reader.close()}
})
test('Bilt per-request deadline settles an injected transport that ignores its signal',async()=>{
 const reader=createBiltReader({requestIntervalMs:0,requestTimeoutMs:20,fetchImpl:async()=>new Promise(()=>{})})
 try{await assert.rejects(reader.read(HOME),error=>error.name==='TimeoutError')}finally{reader.close()}
})
test('Bilt late response is disposed without waiting for a stalled cancellation',async()=>{
 const caller=new AbortController(),reason=Object.freeze({caller:'late'});let resolveResponse,entered,disposed=0
 const started=new Promise(resolve=>{entered=resolve})
 const reader=createBiltReader({signal:caller.signal,requestIntervalMs:0,fetchImpl:async()=>{entered();return new Promise(resolve=>{resolveResponse=resolve})}})
 try{const pending=reader.read(HOME);await started;caller.abort(reason);await assert.rejects(pending,error=>error===reason);resolveResponse({body:{cancel(){disposed++;return new Promise(()=>{})}}});await new Promise(resolve=>setImmediate(resolve));assert.equal(disposed,1)}finally{reader.close()}
})
test('Bilt reader refuses undiscovered tenants and preserves sourceURL metadata',async()=>{
 let calls=0
 const reader=createBiltReader({requestIntervalMs:0,fetchImpl:async url=>{calls++;return reply(url+'?unexpected=true')}})
 try{await assert.rejects(reader.read('https://j.brt.mv/jb.do?reqGK=27786539&companyGK=1&portalGK=37115'),/Unbound/);assert.equal(calls,0);await assert.rejects(reader.read(HOME),/URL changed/);assert.equal(reader.receipts[0].finalURL,HOME+'?unexpected=true')}finally{reader.close()}
})

const xml=originals.get(FEED).html
test('Bilt preserves genuine alternate RSS role URLs without rewriting native identity or granting undiscovered reads',async()=>{
 const actual=gunzipSync(readFileSync(new URL('./test-data-20261107/alternate-channel-rss.xml.gz',import.meta.url))).toString('utf8')
 const parsed=readBiltRSS(actual)
 assert.equal(parsed.metadata.link,'https://ejob.bz/CompanyPortal.do?companyGK=46774&portalGK=37115')
 const older=readBiltRSS(xml)
 assert.ok(parsed.rows.every(row=>new URL(row.link).origin==='https://ejob.bz'))
 for(const [index,row]of parsed.rows.entries())assert.deepEqual({...row,link:null},{...older.rows[index],link:null})
 const reader=createBiltReader({requestIntervalMs:0,fetchImpl:()=>{throw Error('Alternate declaration must never be followed')}})
 try{await assert.rejects(reader.read(parsed.metadata.link),/Unbound/);await assert.rejects(reader.read(parsed.rows[0].link),/Unbound/)}finally{reader.close()}
})
for(const [name,mutate,reason]of [
 ['external DTD',value=>value.replace('<rss','<!DOCTYPE rss SYSTEM="https://example.invalid/entity"><rss'),/element/],
 ['duplicate identity',value=>value.replace('<guid>','<guid>10968469-d92d-470b-8497-94b8a2cedf03</guid><guid>'),/row fields|duplicate/],
 ['unknown row criteria',value=>value.replace('</item>','<requirements>Unreviewed mandatory criterion</requirements></item>'),/row fields/],
 ['different employer',value=>value.replace('BILT Inc. Jobs','Another Employer Jobs'),/employer/],
 ['different native tenant',value=>value.replaceAll('companyGK=46774','companyGK=46775'),/employer|identity/],
 ['invalid publication calendar',value=>value.replace('Fri, 02 Oct 2026','Fri, 32 Oct 2026'),/calendar/],
 ['unparsed trailing XML',value=>value+'<rss version="2.0"></rss>',/Trailing/],
 ['unknown entity',value=>value.replace('<language>en-us','<language>&unknown;en-us'),/entity/],
 ['control in CDATA',value=>value.replace('Job Title:',String.fromCharCode(0)+'Job Title:'),/body/],
])test('Bilt finite RSS refuses '+name,()=>{assert.throws(()=>readBiltRSS(mutate(xml)),reason)})

const firstRole=fixture.records.find(row=>row.requestedURL.includes('/jb.do?')).requestedURL
const changeSchema=(html,change)=>{
 const carrier=readNativeDocument(html).nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json')[0]
 const schema=JSON.parse(carrier.raw);change(schema)
 return html.replace(carrier.raw,JSON.stringify(schema).replaceAll('<','\\u003c'))
}
for(const [name,mutate,reason]of [
 ['wrong native employer',html=>changeSchema(html,value=>{value.hiringOrganization.name='Another Employer'}),/employer/],
 ['unbound own identifier',html=>changeSchema(html,value=>{value.identifier.value='27786540'}),/identity/],
 ['missing typed country even with an India city label',html=>changeSchema(html,value=>{delete value.jobLocation.address.addressCountry;value.jobLocation.address.addressLocality='Bengaluru'}),/address/],
 ['unknown country literal',html=>changeSchema(html,value=>{value.jobLocation.address.addressCountry='UNKNOWN'}),/country/],
 ['publication refresh to collection date',html=>changeSchema(html,value=>{value.datePosted='2026-11-06'}),/publication/],
 ['unknown native mandatory criteria field',html=>changeSchema(html,value=>{value.qualifications='Additional mandatory requirement'}),/fields/],
 ['changed full native criteria',html=>changeSchema(html,value=>{value.description+='<p>Additional mandatory requirement</p>'}),/criteria/],
 ['hidden own container',html=>html.replace('id="portal_container"','hidden id="portal_container"'),/Hidden/],
 ['unreviewed inline authority program',html=>html.replace('let jobs = [];','let jobs = []; document.body.innerHTML = "changed";'),/program/],
 ['nonempty custom criteria',html=>html.replace('id="custom_content_req" class="custom_content clearfix">','id="custom_content_req" class="custom_content clearfix">Additional mandatory criterion'),/custom criteria/],
])test('Bilt holds full original evidence for '+name,async()=>{
 const jobs=await run({requestIntervalMs:0,fetchPage:async url=>{const page=structuredClone(originals.get(url));assert.ok(page);if(url===firstRole)page.html=mutate(page.html);return page},now:()=> '2026-11-06T21:32:58.153Z'})
 assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'bilt').observedVacancyCount,4)
 assert.equal(jobs.sourceAudit.fullServerPublishedNativeModels,3)
 assert.equal(jobs.sourceAudit.heldRoles.length,1)
 const held=jobs.sourceAudit.heldRoles[0];assert.equal(held.id,'27786539');assert.match(held.reason,reason)
 assert.equal(held.opening.complete,false);assert.equal(held.closing.complete,false)
 assert.ok(held.opening.originalRawHTML.length>60000)
 assert.equal(held.opening.rssItem.description,readBiltRSS(xml).rows[0].description)
})
test('Bilt detects full criteria change at closing and retains both original role models',async()=>{
 let reads=0
 const jobs=await run({requestIntervalMs:0,fetchPage:async url=>{const page=structuredClone(originals.get(url));if(url===firstRole&&++reads===2)page.html=page.html.replaceAll('revolutionizing','transforming');return page},now:()=> '2026-11-06T21:32:58.153Z'})
 assert.equal(jobs.sourceAudit.fullServerPublishedNativeModels,3);assert.equal(jobs.sourceAudit.heldRoles.length,1)
 assert.equal(jobs.sourceAudit.openingRoles[0].complete,true);assert.equal(jobs.sourceAudit.closingRoles[0].complete,false)
 assert.equal(jobs.sourceAudit.allRoleModelsOpeningClosingStable,false)
})
test('Bilt reconciles only genuinely published alternate URLs with identical full own canonical models',async()=>{
 const alternate=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/declared-alternate-http.json.gz',import.meta.url))))
 const later=new Map(alternate.records.map(row=>[row.url,{url:row.finalURL,status:row.status,contentType:row.responseHeaders['content-type'],html:Buffer.from(row.bodyBase64,'base64').toString('utf8')}]))
 const declared=later.get(FEED)
 // The final packet for this URL is the genuine old-origin closing body;
 // select the explicitly recorded alternate-origin opening body instead.
 const alternateRSS=alternate.records.find(row=>row.url===FEED&&Buffer.from(row.bodyBase64,'base64').toString('utf8').includes('<link>https://ejob.bz/CompanyPortal.do'))
 assert.ok(alternateRSS);assert.match(alternate.qualification,/not an actual successful closing/)
 const alternatePage={...declared,html:Buffer.from(alternateRSS.bodyBase64,'base64').toString('utf8')};let feeds=0
 const jobs=await run({requestIntervalMs:0,fetchPage:async url=>{
  if(url===FEED)return structuredClone(++feeds===1?originals.get(url):alternatePage)
  const page=originals.get(url)??later.get(url);assert.ok(page,'Only genuine declared bodies');return structuredClone(page)
 },now:()=> '2026-11-06T23:45:00.000Z'})
 assert.equal(jobs.sourceAudit.fullServerPublishedNativeModels,4);assert.equal(jobs.sourceAudit.heldRoles.length,0)
 for(const proof of jobs.sourceAudit.declaredRoleURLReconciliation){
  assert.equal(new URL(proof.openingURL).origin,'https://j.brt.mv');assert.equal(new URL(proof.closingURL).origin,'https://ejob.bz')
  assert.equal(proof.openingCanonical,proof.closingCanonical);assert.equal(proof.URLRewritingPerformed,false)
 }
})
test('Bilt primary403 survives a stalled denied body until its request deadline',async()=>{
 const reader=createBiltReader({requestIntervalMs:0,requestTimeoutMs:20,fetchImpl:async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read(){return new Promise(()=>{})},cancel(){return new Promise(()=>{})},releaseLock(){}}}}})})
 try{await assert.rejects(reader.read(HOME),error=>error.status===403&&error.failureKind==='blocked_or_access_denied')}finally{reader.close()}
})

for(const [name,change]of [
 ['own countryCode',s=>s.replace('id="portal_container"','id="portal_container" data-countrycode="IN"')],
 ['own Location country',s=>s.replace(/(<dt>\s*Location\s*<\/dt>\s*<dd)/,'$1 data-country="IN"')],
 ['own Location countryName',s=>s.replace(/(<dt>\s*Location\s*<\/dt>\s*<dd)/,'$1 data-countryname="India"')],
 ['own Other Location nested country',s=>s.replace(/(<dt>\s*Other Location\s*<\/dt>\s*<dd[^>]*>)/,'$1<meta itemprop="addressCountry" content="IN">')],
 ['own Other Location nested employer',s=>s.replace(/(<dt>\s*Other Location\s*<\/dt>\s*<dd[^>]*>)/,'$1<span data-hiringorganization="Different employer"></span>')],
 ['own custom country',s=>s.replace('id="custom_content_req" class="custom_content clearfix">','id="custom_content_req" class="custom_content clearfix"><meta name="country" content="IN">')],
 ['additional visible mandatory criterion',s=>s.replace('</h2>','</h2><section>Additional mandatory qualification: possession of current clearance.</section>')],
 ['additional hidden custom criterion',s=>s.replace('id="custom_content_req" class="custom_content clearfix">','id="custom_content_req" class="custom_content clearfix"><div hidden>Additional mandatory qualification: possession of current clearance.</div>')],
 ['additional hidden Other Location criterion',s=>s.replace(/(<dt>\s*Other Location\s*<\/dt>\s*<dd[^>]*>)/,'$1<div hidden>Additional mandatory qualification: possession of current clearance.</div>')],
])test('Bilt independent-review guard retains and holds '+name,async()=>{
 let mutations=0
 const jobs=await run({requestIntervalMs:0,fetchPage:async url=>{const page=structuredClone(originals.get(url));assert.ok(page);if(url===firstRole){const changed=change(page.html);assert.notEqual(changed,page.html);page.html=changed;mutations++}return page},now:()=> '2026-11-06T21:32:58.153Z'})
 assert.equal(mutations,2);assert.equal(jobs.sourceAudit.fullServerPublishedNativeModels,3);assert.equal(jobs.sourceAudit.heldRoles.length,1)
 const held=jobs.sourceAudit.heldRoles[0];assert.equal(held.id,'27786539');assert.equal(held.opening.complete,false);assert.equal(held.closing.complete,false)
 assert.ok(held.opening.originalRawHTML.includes('IN')||held.opening.originalRawHTML.includes('Additional mandatory'))
 assert.equal(held.opening.rssItem.description,readBiltRSS(xml).rows[0].description)
 assert.equal(readSourceObservationEvidence(jobs,'bilt').observedVacancyCount,4)
})
test('Bilt empty optional own-country attribute remains raw uncertainty without affecting the genuine typed country',async()=>{
 const jobs=await run({requestIntervalMs:0,fetchPage:async url=>{const page=structuredClone(originals.get(url));if(url===firstRole)page.html=page.html.replace('id="portal_container"','id="portal_container" data-country=""');return page}})
 assert.equal(jobs.sourceAudit.fullServerPublishedNativeModels,4);assert.equal(jobs.sourceAudit.heldRoles.length,0)
 assert.ok(jobs.sourceAudit.observations.every(role=>role.country==='United States'))
 const receipt=jobs.sourceAudit.receipts.find(row=>row.requestedURL===firstRole)
 assert.ok(Buffer.from(receipt.bodyBase64,'base64').toString('utf8').includes('data-country=""'))
})
test('Bilt primary denial keeps its upstream classification through the registered source',async()=>{
 const {classifyScraperError}=await import('../../scraper-support/utils/failureClassification.js')
 await assert.rejects(run({requestIntervalMs:0,fetchPage:async url=>({url,status:403,contentType:'text/html',html:'Access Denied'})}),error=>{
  assert.equal(error.status,403);assert.equal(error.upstreamOutage,true)
  assert.equal(classifyScraperError(error).failureKind,'blocked_or_access_denied');assert.equal(classifyScraperError(error).upstreamOutage,true)
  return true
 })
})

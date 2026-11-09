import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createRequire,registerHooks} from 'node:module'
import {validateRow,parseDetail} from './nativeContract.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const sha=b=>createHash('sha256').update(b).digest('hex'),compressed=fs.readFileSync(new URL('./test-inputs/current-worksites-20261107.json.gz',import.meta.url))
assert.equal(sha(compressed),'4355b8727d6e108a179db616dccac3eefe13fa11b8a720c8131e3ee019f933a2')
const fixture=JSON.parse(gunzipSync(compressed)),raw=fixture.models.rows.find(r=>r.id==='177064'),heldPacket=fixture.packets.find(p=>p.url.endsWith('/177064-en_US')),heldHTML=Buffer.from(heldPacket.bodyBase64,'base64').toString(),options={allowReviewedWorksiteGap:true},provider=getScraperCatalog().find(p=>p.source==='colgatepalmolive')
function guardDatabase(t){
 let databaseAttempts=0
 const require=createRequire(import.meta.url),mongoose=require('mongoose'),{MongoClient}=require('mongodb'),deny=()=>{databaseAttempts++;throw Error('Colgate worksite offline DB tripwire')}
 for(const [object,key]of [[mongoose,'connect'],[mongoose,'createConnection'],[mongoose.Connection.prototype,'openUri'],[MongoClient,'connect'],[MongoClient.prototype,'connect']])t.mock.method(object,key,deny)
 const hook=registerHooks({load(url,context,next){if(/\/utils\/saveToDB\.js(?:\?|$)/.test(url))deny();return next(url,context)}});t.after(()=>{hook.deregister();assert.equal(databaseAttempts,0)})
}
async function replay(t,{rowChange=()=>{},bodyChange=(_p,_n,b)=>b}={}){
 guardDatabase(t)
 const calls=[],seen=new Map()
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input),body=init.body??'',packets=fixture.packets.filter(p=>p.url===url&&p.method===(init.method??'GET')&&p.requestBodySHA256===sha(body));assert.ok(packets.length,'Only actual declared public requests, no application/auth/network activity')
  const key=url+'|'+sha(body),n=(seen.get(key)||0)+1;seen.set(key,n);const p=packets[Math.min(n-1,packets.length-1)],bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(sha(bytes),p.bodySHA256);assert.equal(bytes.length,p.bodyBytes);assert.equal(init.redirect,'error');calls.push(url)
  let html=bytes.toString();if(url.endsWith('/services/recruiting/v1/jobs')){const d=JSON.parse(html);if(d.jobSearchResult)for(const entry of d.jobSearchResult)if(entry.response.id==='177064')rowChange(entry.response);html=JSON.stringify(d)}
  html=bodyChange(p,n,html)
  const headers=new Headers(p.responseHeaders);if(p.responseSetCookie){headers.delete('set-cookie');for(const s of p.responseSetCookie)headers.append('set-cookie',s)}
  const response=new Response(html,{status:p.status,headers});Object.defineProperty(response,'url',{value:p.finalURL});return response
 })
 return{calls,run:()=>createCatalogScraper(provider).run({now:fixture.now})}
}

test('strict default parser still refuses the current four-office record',()=>{assert.throws(()=>validateRow(raw,fixture.now),/location scope missing/)})
test('finite reviewed record validates all offices and yields a full explicit pool/city-set hold without Mumbai borrowing',()=>{
 const row=validateRow(raw,fixture.now,options),model=parseDetail(heldHTML,row,fixture.now,options)
 assert.equal(model.nativeRecordKind,'hiring-signal');assert.equal(model.sourceWorksiteStatus,'held');assert.equal(model.location,null);assert.deepEqual(model.locations,[]);assert.equal(model.city,null)
 assert.deepEqual(model.nativeRawLocations,raw.jobLocationShort);assert.equal(model.nativeDetailLocation,'Ahmedabad, Gujarat, India');assert.equal(model.nativeCompanyBrand,'Colgate-Palmolive');assert.equal(model.nativeLegalEmployer,null)
 assert.equal(model.sourceDetailComplete,true);assert.ok(model.jobDescription.includes('active pooling'));assert.ok(model.jobDescription.includes('must apply again'));assert.equal(model.postedAt,'2026-10-29T00:00:00.000Z')
})
test('registered current flow retains all24 raw records, returns23 complete Mumbai roles and preserves full explicit pool hold/closing',async t=>{
 const r=await replay(t),jobs=await r.run();assert.equal(jobs.length,23);assert.equal(r.calls.length,39)
 assert.ok(jobs.every(j=>j.country==='India'&&j.city==='Mumbai'&&j.sourceDetailComplete&&j.nativeLegalEmployer===null));assert.equal(jobs.some(j=>j.jobId==='177064'),false)
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.nativeModels.length,24);assert.deepEqual(audit.openingNativeRows,fixture.models.rows);assert.deepEqual(audit.closingNativeRows,fixture.models.rows)
 assert.equal(audit.heldNativeRecords.length,1);const h=audit.heldNativeRecords[0];assert.equal(h.reason,'native-list-detail-city-set-conflict-and-explicit-talent-pool');assert.deepEqual(h.nativeRecord,raw);assert.deepEqual(h.closingNativeRecord,raw);assert.deepEqual(h.nativeDetail,h.closingNativeDetail)
 assert.equal(h.nativeDetail.nativeRecordKind,'hiring-signal');assert.ok(h.nativeDetail.jobDescription.includes('active pooling'));assert.equal(h.nativeDetail.city,null)
 for(const p of audit.originalResponses){assert.equal(p.bodyReadKind,'original-bytes');assert.equal(sha(Buffer.from(p.bodyBase64,'base64')),p.bodySHA256)}
 assert.equal(audit.originalResponses.length,39);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 const observed=readSourceObservationEvidence(jobs,'colgatepalmolive');assert.equal(observed.recordKind,'mixed');assert.equal(observed.observedRecordCount,24);assert.equal(observed.observedVacancyCount,23);assert.equal(observed.companyGlobalTotal,null);assert.equal(observed.companyIndiaTotal,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
for(const [name,change]of[
 ['UID',r=>{r.id='177065'}],['title',r=>{r.unifiedStandardTitle+=' changed'}],['country',r=>{r.jobLocationShort[0]='Sanand, GJ, USA, '}],
 ['unknown office',r=>{r.jobLocationShort[0]='Ahmedabad, GJ, IND, '}],['duplicate office',r=>{r.jobLocationShort[1]=r.jobLocationShort[0]}],
 ['missing office',r=>{r.jobLocationShort.pop()}],['country alias',r=>{r.countryCode='US'}],['unknown shape',r=>{r.additional_location={country:'US'}}],
 ['coordinate',r=>{r.jobLocationShortWithCoordinates[0].key='0,0'}],['coordinate country',r=>{r.jobLocationShortWithCoordinates[0].country='US'}],
 ['duplicate coordinate office',r=>{r.jobLocationShortWithCoordinates[1]=r.jobLocationShortWithCoordinates[0]}],['missing coordinate',r=>{r.jobLocationShortWithCoordinates.pop()}],
 ['employer',r=>{r.filter5=['Other employer']}],['invalid publication calendar',r=>{r.unifiedStandardStart='2/30/26'}],['future publication',r=>{r.unifiedStandardStart='1/1/99'}],
])test('reviewed hold refuses malformed '+name,()=>{const row=structuredClone(raw);change(row);assert.throws(()=>validateRow(row,fixture.now,options))})
for(const [name,change]of[
 ['foreign own country',b=>b.replace('Ahmedabad, Gujarat, India','Ahmedabad, Gujarat, United States')],
 ['wrong own requisition',b=>b.replaceAll('Job Number&nbsp;#177064','Job Number&nbsp;#999999').replaceAll('Job Number #177064','Job Number #999999')],
 ['wrong canonical identity',b=>b.replace('rel="canonical" href="https://jobs.colgate.com/job/Team-Lead-Operations/177064-en_US/"','rel="canonical" href="https://jobs.colgate.com/job/Team-Lead-Operations/999999-en_US/"')],
 ['wrong application identity',b=>b.replaceAll('/talentcommunity/apply/177064/','/talentcommunity/apply/999999/')],
 ['unqualified changed own city',b=>b.replaceAll('Ahmedabad','Unreviewed City')],
 ['missing pool provenance',b=>b.replace('This is for active pooling','This is for ordinary hiring')],
])test('held record cannot swallow '+name,()=>{const row=validateRow(raw,fixture.now,options),changed=change(heldHTML);assert.notEqual(changed,heldHTML);assert.throws(()=>parseDetail(changed,row,fixture.now,options))})
test('held full criteria changing at closing fails the entire registered run',async t=>{
 const r=await replay(t,{bodyChange:(p,n,body)=>p.url===heldPacket.url&&n===2?body.replace('Role Summary/Purpose','Changed Role Summary/Purpose'):body});await assert.rejects(r.run(),/held.*changed|changed.*held/i)
})
test('a foreign coordinate carrier is not downgraded into a successful hold',async t=>{
 const r=await replay(t,{rowChange:row=>{row.jobLocationShortWithCoordinates[0].countryCode='US'}});await assert.rejects(r.run())
})

test('actual no-options default replays ALL39 original responses/init/79clocks and ENTIRE23jobs/24records/held audit/inventory output',async t=>{
 guardDatabase(t)
 const captured=fixture.registeredDefault,clocks=[...captured.sourceClocks],RealDate=Date,calls=[];let sharedSignal
 globalThis.Date=new Proxy(RealDate,{construct(Target,args,newTarget){if(args.length===0&&/scraper[\\/]colgatepalmolive\.workday[\\/]nativeRun\.js/.test(new Error().stack)){const clock=clocks.shift();assert.equal(clock?.kind,'construct');return Reflect.construct(Target,[clock.value],newTarget)}return Reflect.construct(Target,args,newTarget)},get(Target,key,receiver){if(key==='now')return()=>{if(/scraper[\\/]colgatepalmolive\.workday[\\/]nativeRun\.js/.test(new Error().stack)){const clock=clocks.shift();assert.equal(clock?.kind,'now');return clock.value}return Target.now()};return Reflect.get(Target,key,receiver)}})
 t.after(()=>{globalThis.Date=RealDate})
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const p=captured.packets[calls.length];assert.ok(p,'No extra native/auth/application requests')
  assert.equal(String(input),p.url);assert.deepEqual(Object.keys(init).sort(),['body','headers','method','redirect','signal']);assert.equal(init.method,p.method);assert.equal(init.redirect,p.redirect);assert.equal(init.credentials,undefined)
  assert.equal(sha(JSON.stringify(Object.fromEntries(new Headers(init.headers)))),sha(JSON.stringify(p.sourceHeaders)))
  const request=Buffer.from(init.body??'');assert.equal(sha(request),p.requestBodySHA256);assert.equal(request.length,p.requestBodyBytes);assert.equal(request.toString('base64'),p.requestBodyBase64)
  assert.ok(init.signal instanceof AbortSignal);sharedSignal??=init.signal;assert.equal(init.signal,sharedSignal)
  const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(bytes.length,p.bodyBytes);assert.equal(sha(bytes),p.bodySHA256)
  const headers=new Headers(p.responseHeaders);headers.delete('set-cookie');for(const cookie of p.responseSetCookie)headers.append('set-cookie',cookie)
  const response=new Response(bytes,{status:p.status,headers});Object.defineProperty(response,'url',{value:p.finalURL});calls.push(p.bodySHA256);return response
 })
 const jobs=await createCatalogScraper(provider).run(),actual={jobs,inventory:readInventoryEvidence(jobs),observations:readSourceObservationEvidence(jobs,'colgatepalmolive'),nativeCollectionEvidence:jobs.nativeCollectionEvidence,error:null}
 assert.equal(calls.length,39);assert.equal(clocks.length,0);assert.equal(sha(JSON.stringify(actual)),captured.result.fullOutput.SHA256);assert.deepEqual(actual,captured.fullOutput)
 assert.equal(jobs.length,23);assert.equal(actual.nativeCollectionEvidence.observations.length,24);assert.equal(actual.observations.observedVacancyCount,23);assert.equal(actual.nativeCollectionEvidence.heldNativeRecords.length,1)
 assert.equal(actual.nativeCollectionEvidence.otherPublicDetailsClosingRechecked,false);assert.equal(actual.nativeCollectionEvidence.heldPublicDetailClosingRechecked,true)
})

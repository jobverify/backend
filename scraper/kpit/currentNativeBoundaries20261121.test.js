import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {performance} from 'node:perf_hooks'
import * as current from './currentNativeFacts20261121.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

// Saved publisher entities only. Repeated response pairs below are controlled
// fixture transactions, not proof of a fresh physical closing or browser run.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const key=value=>{const u=new URL(value);u.hash='';return u.href}
const packets=new Map(fixture.packets.map(p=>[key(p.requestedURL),p]))
const entity=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
const listing=entity(packets.get(current.LISTING_URL)),cards=current.readCards(listing)
const nativeURL=card=>'https://talentojo.kpit.com/service/jobs/'+card.nativeID
const original=card=>JSON.parse(entity(packets.get(nativeURL(card))))
const completeCard=cards.find(card=>current.readRole(JSON.stringify(original(card)),card).sourceRoleQualified)
assert.ok(completeCard,'Actual fixture contains a role with complete authored native criteria')
const readChanged=change=>{const value=original(completeCard);change(value);return current.readRole(JSON.stringify(value),completeCard)}
const contractFailure=(fn,pattern)=>assert.throws(fn,error=>{assert.equal(error.failureKind,'coverage_gap');assert.equal(error.lifecycleCleanupAllowed,false);assert.match(error.message,pattern);return true})
const heldOrContractFailure=(fn,pattern)=>{
 let model
 try{model=fn()}catch(error){assert.equal(error.failureKind,'coverage_gap');assert.equal(error.lifecycleCleanupAllowed,false);assert.match(error.message,pattern);return}
 assert.equal(model.sourceRoleQualified,false);assert.ok(model.holds.some(reason=>pattern.test(reason)));return model
}

function replay(t,change=({body})=>body){
 let clock=0
 // Advance a monotonic replay clock only when an in-memory HTTP entity is
 // delivered. Each600ms step satisfies native500ms pacing and stays inside
 // the existing15s request/90s source ceilings. No timer/byte limit is removed.
 t.mock.method(performance,'now',()=>clock)
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Physical network forbidden in native fixture tests')})
 const visits=new Map(),calls=[]
 const fetchImpl=async input=>{
  const url=String(input),packet=packets.get(key(url));assert.ok(packet,'Only literally captured native URLs: '+url)
  const visit=(visits.get(url)??0)+1;visits.set(url,visit);assert.ok(visit<=2,'Opening and closing only')
  clock+=600
  const body=change({url,visit,body:entity(packet),packet});calls.push({url,visit,body})
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:key(packet.url)})
 }
 return {calls,options:{fetchImpl,sourceTimeoutMs:90000,requestTimeoutMs:15000}}
}

test('all16 actual native rows retain whole employer/criteria/country/application/date models with3 linked-JD holds',()=>{
 const models=cards.map(card=>current.readRole(JSON.stringify(original(card)),card))
 assert.equal(models.length,16);assert.equal(models.filter(m=>m.sourceRoleQualified).length,13);assert.equal(models.filter(m=>!m.sourceRoleQualified).length,3)
 for(const model of models){assert.deepEqual(model.wholeNativeRecord,original(model.card));assert.equal(model.wholeNativeRecord.job.country,'India');assert.equal(model.wholeNativeRecord.organization.name,'KPIT');assert.ok(model.criteria.length>=200);assert.ok(model.description.includes(model.criteria));assert.match(model.card.url,/^https:\/\/talentojo[.]kpit[.]com\/tojo\/app\/job-apply\/#\/Career%20Portal\/[1-9]\d+$/)}
})
for(const [name,change]of[
 ['employer',p=>{p.organization.name='Different employer'}],
 ['organization account',p=>{p.organization.id=134}],
 ['role account',p=>{p.job.organization_id='134'}],
 ['literal role ID',p=>{p.job.id=String(Number(p.job.id)+1)}],
 ['visible role title',p=>{p.job.title='Different native role';p.job.display_title='Different native role'}],
])test('actual role binding rejects changed '+name,()=>contractFailure(()=>readChanged(change),/employer|account|identity|card|title/i))

for(const [name,change]of[
 ['missing native country',p=>{delete p.job.country}],
 ['null native country',p=>{p.job.country=null}],
 ['foreign native country',p=>{p.job.country='Germany'}],
 ['missing native locations',p=>{p.job.location=[]}],
 ['conflicting explicit location country',p=>{p.job.location=['Munich, Germany']}],
])test('no India qualification from '+name,()=>heldOrContractFailure(()=>readChanged(change),/country|location|workplace/i))

test('all authored supplementary eligibility remains in full record and exposed description',()=>{
 const marker='Actual-source supplementary eligibility mutation'
 const model=readChanged(p=>{p.job.comments=marker;p.job.additional_skills='Native additional skill mutation';p.job.description+='<p>Native full description mutation</p>'})
 assert.equal(model.sourceRoleQualified,true);assert.ok(model.description.includes(marker));assert.ok(model.description.includes('Native additional skill mutation'));assert.ok(model.description.includes('Native full description mutation'));assert.equal(model.wholeNativeRecord.job.comments,marker)
})
test('unreviewed native eligibility field cannot disappear outside complete criteria',()=>contractFailure(()=>readChanged(p=>{p.job.additionalRequirements='New mandatory authored qualification'}),/schema|criteria|field/i))
for(const html of ['<p hidden>Hidden mandatory qualification</p>','<p style="display:none">Hidden mandatory qualification</p>','<p aria-hidden="true">Hidden mandatory qualification</p>'])test('authored hidden criteria is held: '+html.slice(0,28),()=>contractFailure(()=>readChanged(p=>{p.job.description+=html}),/criteria|hiding|hidden/i))
for(const [name,change]of[
 ['closed authored role',p=>{p.job.description+='<p>This position is closed.</p>'}],
 ['unpublished native status',p=>{p.job.status='Draft'}],
 ['exhausted native application availability',p=>{p.job.resume_upload_limit_exhausted=true}],
])test('native current availability rejects '+name,()=>contractFailure(()=>readChanged(change),/criteria|closed|publication|availability/i))

test('duplicate JSON native identity keys cannot overwrite earlier conflicting values',()=>{
 const raw=JSON.stringify(original(completeCard)).replace(/"id"\s*:/,'"id":"conflicting-original-id","id":')
 contractFailure(()=>current.readRole(raw,completeCard),/Malformed|duplicate/i)
})
test('actual linked full-JD rows remain full held observations without following links or inventing criteria',()=>{
 const held=cards.map(card=>current.readRole(JSON.stringify(original(card)),card)).filter(m=>!m.sourceRoleQualified)
 assert.equal(held.length,3)
 for(const model of held){assert.ok(model.authoredRoleLinks.length>0);assert.ok(model.holds.includes('linked-full-job-description-or-alternative-application-unqualified'));assert.deepEqual(model.wholeNativeRecord,original(model.card));assert.ok(model.description.includes(model.criteria))}
})

test('controlled complete native transaction separates public shell reads from unverified application interactions and dates',async t=>{
 const r=replay(t),jobs=await current.run(r.options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,13);assert.equal(audit.observedVacancyCount,16);assert.equal(audit.wholeNativeRoleModelsClosingReconciled,true);assert.equal(audit.publicNativeApplicationShellReads,2);assert.equal(audit.applicationInteractions,0);assert.equal(audit.applicationSubmissions,0);assert.equal(audit.renderedApplicationQualified,false);assert.equal(audit.activeApplyVerified,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(r.calls.length,44)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.postingDate,null);assert.equal(job.closingDate,null);assert.equal(job.sourceNativeCreatedAtRaw,job.sourceNativeRecord.job.created_at);assert.equal(job.sourceNativeUpdatedAtRaw,job.sourceNativeRecord.job.updated_at);assert.equal(job.sourceNativeExpectedJoiningDateRaw,job.sourceNativeRecord.job.expected_joining_date??null);assert.equal(job.sourceDateSemanticsUnresolved,true);assert.equal(job.activeApplyVerified,false);assert.equal(job.applyUrl,cards.find(c=>c.nativeID===job.jobId).url)}
})

test('complete closing authored-criteria drift preserves both full models and originals without reconciliation',async t=>{
 const marker='Closing mandatory native criterion',target=nativeURL(completeCard),r=replay(t,({url,visit,body})=>{if(url!==target||visit!==2)return body;const value=JSON.parse(body);value.job.comments=marker;return JSON.stringify(value)})
 await assert.rejects(current.run(r.options),error=>{const a=error.recruitmentObservations;assert.equal(a.wholeNativeRoleModelsClosingReconciled,false);assert.equal(a.nativeOpening.roles.length,16);assert.equal(a.nativeClosing.roles.length,16);assert.notEqual(a.nativeOpening.roles.find(m=>m.card.nativeID===completeCard.nativeID).wholeNativeRecord.job.comments,marker);assert.equal(a.nativeClosing.roles.find(m=>m.card.nativeID===completeCard.nativeID).wholeNativeRecord.job.comments,marker);const raw=a.rawPublisherResponses.filter(p=>p.url===target);assert.equal(raw.length,2);assert.ok(!raw[0].body.includes(marker));assert.ok(raw[1].body.includes(marker));assert.equal(a.lifecycleCleanupAllowed,false);return true})
})
test('failed closing new criterion preserves raw failed entity before schema rejection',async t=>{
 const marker='Closing unknown authored eligibility',target=nativeURL(completeCard),r=replay(t,({url,visit,body})=>{if(url!==target||visit!==2)return body;const value=JSON.parse(body);value.job.additionalRequirements=marker;return JSON.stringify(value)})
 await assert.rejects(current.run(r.options),error=>{const a=error.recruitmentObservations;assert.match(error.message,/schema/);assert.equal(a.wholeNativeRoleModelsClosingReconciled,false);assert.equal(a.nativeOpening.roles.length,16);const raw=a.rawPublisherResponses.filter(p=>p.url===target);assert.equal(raw.length,2);assert.ok(raw[1].body.includes(marker));assert.equal(a.lifecycleCleanupAllowed,false);return true})
})

test('known403 status wins before stalled entity and retains HTTP receipt without a zero-inventory claim',async()=>{
 let bodyTouched=false
 await assert.rejects(current.run({fetchImpl:async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:{cancel:async()=>{},getReader(){bodyTouched=true;throw Error('Denied body must not be read')}}})}),error=>{assert.equal(error.status??error.httpStatus,403);const a=error.recruitmentObservations;assert.equal(a.originalResponses[0].status,403);assert.equal(a.originalResponses[0].bodyComplete,false);assert.equal(a.companyIndiaZeroProven,false);assert.equal(a.lifecycleCleanupAllowed,false);return true});assert.equal(bodyTouched,false)
})
test('registered current source rejects obsolete body-only callback without any physical fallback',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Physical fallback is forbidden')});const provider=getScraperCatalog().find(p=>p.source==='kpit');await assert.rejects(createCatalogScraper(provider).run({fetchText:async()=>listing}),/Original current HTTP metadata/)
})
for(const reason of [null,Object.freeze({caller:'opaque'})]){
 test('exact caller pre-abort '+String(reason),async()=>{const c=new AbortController();c.abort(reason);let calls=0;await assert.rejects(current.run({signal:c.signal,fetchImpl:async()=>{calls++;throw Error('must remain unread')}}),e=>e===reason);assert.equal(calls,0)})
 test('exact in-flight caller reason after native response resolves '+String(reason),async()=>{const c=new AbortController();let cancelled=false;await assert.rejects(current.run({signal:c.signal,fetchImpl:async url=>{c.abort(reason);return {status:200,url,headers:new Headers({'content-type':'text/html'}),body:{cancel:async()=>{cancelled=true}}}}}),e=>e===reason);assert.equal(cancelled,true)})
 for(const path of ['success-attachment','error-attachment','success-close','error-close'])test('exact caller retained after final '+path+' '+String(reason),async t=>{
  const r=replay(t),c=new AbortController(),define=Object.defineProperty,abort=AbortController.prototype.abort
  if(path.endsWith('attachment'))t.mock.method(Object,'defineProperty',function(target,key,descriptor){const value=define(target,key,descriptor);if(key==='recruitmentObservations'&&(path.startsWith('success')?Array.isArray(target):target instanceof Error))c.abort(reason);return value})
  else t.mock.method(AbortController.prototype,'abort',function(...args){const value=abort.apply(this,args);if(this!==c&&args.length===0)c.abort(reason);return value})
  const fetchImpl=path.startsWith('success')?r.options.fetchImpl:async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:null})
  await assert.rejects(current.run({...r.options,signal:c.signal,fetchImpl}),e=>e===reason)
 })
}

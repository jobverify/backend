import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {HOMEPAGE_URL,CAREERS_URL,ENQUIRY_URL,run} from './script.js'
import {PROGRAM_URL,readCurrentElectrosteel,readCurrentElectrosteelCareer,readCurrentElectrosteelEnquiry} from './currentNative20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
const original=url=>fixture.responses.find(r=>r.url===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
function replay(edit=(row,text)=>text){const calls=[],counts=new Map();return {calls,fetchImpl:async(url,init)=>{const row=original(url);assert.ok(row);calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const n=(counts.get(url)??0)+1;counts.set(url,n);return Object.defineProperty(new Response(edit(row,body(row),n),{status:row.status,headers:row.headers}),'url',{value:row.url})}}}
test('Electrosteel native Khoj observations are four unactivated campus role areas with no work country or requisition identity',()=>{
 const model=readCurrentElectrosteelCareer(readCurrentElectrosteel(body(original(CAREERS_URL)),CAREERS_URL))
 assert.equal(model.roleAreas.length,4);assert.ok(model.roleAreas.every(row=>row.recordKind==='programme-role-area'&&row.country===null&&row.jobId===null&&row.criteriaQualified===false&&row.streamActivationQualified===false))
 assert.equal(model.wholeNativeCareerStream.attrs.hidden,'');assert.equal(model.nativeVacancyCohortQualified,false);assert.ok(model.roleAreas[0].label.includes('Graduate Engineer Trainees'));assert.ok(model.roleAreas[3].label.includes('Finance Trainees'))
})
test('Electrosteel complete general candidate form retains native field models and document declaration while PDF/role binding/visible eligibility stay unqualified',()=>{
 const model=readCurrentElectrosteelEnquiry(readCurrentElectrosteel(body(original(ENQUIRY_URL)),ENQUIRY_URL))
 assert.equal(model.nativeFields.length,8);assert.ok(model.nativeFields.some(field=>field.attrs.name==='post_applied_for'&&field.tag==='input'));assert.equal(model.nativeDocumentURL,HOMEPAGE_URL+'api/career-enquiry-document')
 assert.equal(model.nativeDocumentRead,false);assert.equal(model.roleSpecificBindingQualified,false);assert.equal(model.publicApplicationEligibilityQualified,false);assert.equal(model.streamActivationQualified,false)
 assert.ok(body(original(PROGRAM_URL)).includes('submitCareerEnquiry'));assert.ok(body(original(PROGRAM_URL)).includes('File must be 5MB or smaller'))
})
test('Electrosteel literal programme role-area list supports an additional current observation without a frozen four-row cohort or India inference',()=>{
 const native=body(original(CAREERS_URL)),marker='<div>Finance Trainees — CA / CMA / Finance &amp; Accounts</div>';assert.ok(native.includes(marker))
 const changed=native.replace(marker,marker+'</span></li><li><span><div>Additional Native Programme Area</div>'),model=readCurrentElectrosteelCareer(readCurrentElectrosteel(changed,CAREERS_URL))
 assert.equal(model.roleAreas.length,5);assert.equal(model.roleAreas.at(-1).label,'Additional Native Programme Area');assert.equal(model.roleAreas.at(-1).country,null)
})
test('Electrosteel whole closing programme-role-area and general form field models reject drift',async()=>{
 for(const mode of ['role','form']){const {fetchImpl}=replay((row,text,n)=>n===2?mode==='role'&&row.url===CAREERS_URL?text.replace('Graduate Engineer Trainees (GET)','Changed Native Programme Requirement'):mode==='form'&&row.url===ENQUIRY_URL?text.replace('accept="application/pdf"','accept="image/png"'):text:text)
  await assert.rejects(run({fetchImpl}),/Closing.*changed/,mode)
 }
})
test('Electrosteel entire native enquiry programme and direct/nested/URI JobPosting models cannot silently change',async()=>{
 const {fetchImpl}=replay((row,text)=>row.url===PROGRAM_URL?text+';globalThis.ELECTROSTEEL_EXECUTED=true':text)
 await assert.rejects(run({fetchImpl}),/Whole native enquiry client/);assert.equal(globalThis.ELECTROSTEEL_EXECUTED,undefined)
 for(const model of [{'@type':'JobPosting'},{'@graph':[{'@type':'JobPosting'}]},[{'@type':['Thing','https://schema.org/JobPosting']}]] )assert.throws(()=>readCurrentElectrosteel(body(original(CAREERS_URL)).replace('</head>','<script type="application/ld+json">'+JSON.stringify(model)+'</script></head>'),CAREERS_URL),/JobPosting/)
})
test('Electrosteel metadata and original denial/challenge boundaries forbid body-only or alternate-source acquisition',async()=>{
 let callbacks=0;await assert.rejects(run({fetchText:async()=>{callbacks++}}),/Original HTTP metadata/);assert.equal(callbacks,0)
 for(const status of [403,202]){let calls=0,reads=0
  await assert.rejects(run({fetchImpl:async url=>{calls++;return {status,url,headers:new Headers(status===202?{'x-amzn-waf-action':'challenge'}:{}),body:{getReader(){reads++;assert.fail('No denied body read')},cancel:async()=>{}}}}}),error=>error.httpStatus===status&&error.failureKind==='blocked_or_access_denied');assert.equal(calls,1);assert.equal(reads,0)
 }
})
test('Electrosteel frozen opaque in-flight caller cancellation survives fulfilled/rejected original fetches',async()=>{
 for(const mode of ['fulfil','reject']){const controller=new AbortController(),reason=Object.freeze({owner:'electrosteel-'+mode});let calls=0
  await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{calls++;controller.abort(reason);if(mode==='reject')throw Error('transport');return Object.defineProperty(new Response('opaque'),'url',{value:url})}}),error=>error===reason);assert.equal(calls,1)
 }
})

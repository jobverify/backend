import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {ROOT_URL,CAREERS_URL,run} from '../../scraper/edelweiss/script.js'
import {readCurrentEdelweiss} from '../../scraper/edelweiss/currentNative20261117.js'
import {sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/edelweiss/fixtures/native-20261117.json.gz',import.meta.url))))
const original=url=>fixture.responses.find(r=>r.url===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
function replay(edit=(row,text)=>text){const calls=[],counts=new Map();return {calls,fetchImpl:async(url,init)=>{const row=original(url);assert.ok(row);calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const n=(counts.get(url)??0)+1;counts.set(url,n);return Object.defineProperty(new Response(edit(row,body(row),n),{status:row.status,headers:row.headers}),'url',{value:row.url})}}}
test('Edelweiss actual current career article retains the complete general invitation and masked publisher contact without a historical plaintext application address',()=>{
 const model=readCurrentEdelweiss(body(original(CAREERS_URL)),CAREERS_URL)
 assert.ok(model.careerText.includes('Want to join the Edelweiss family?'));assert.ok(model.nativeContactObservedHref.includes('*'));assert.notEqual(model.nativeContactObservedHref,'mailto:GroupTalent.Acquisition@edelweissfin.com')
 assert.equal(model.plaintextHistoricalEmailUsed,false);assert.equal(model.protectedContactDecoded,false);assert.equal(model.contactAddressQualified,false);assert.equal(model.employeeTestimonialsAreVacancies,false)
 assert.ok(model.wholeCareerArticle&&model.nativeContact.attrs['data-original-string']);assert.equal(model.wholeOriginalHTML,body(original(CAREERS_URL)))
})
test('Edelweiss direct nested and array/URI JobPosting additions require acquisition review before any zero-vacancy observation receipt',()=>{
 for(const model of [{'@type':'JobPosting',title:'A native role'},{'@graph':[{'@type':'JobPosting'}]},[{'@type':['Thing','https://schema.org/JobPosting']}]] ){
  const text=body(original(CAREERS_URL)).replace('</head>','<script type="application/ld+json">'+JSON.stringify(model)+'</script></head>')
  assert.throws(()=>readCurrentEdelweiss(text,CAREERS_URL),/JobPosting/)
 }
})
test('Edelweiss whole observed career text and observed contact href changes fail closing reconciliation',async()=>{
 for(const mode of ['text','contact']){const {fetchImpl}=replay((row,text,n)=>row.url===CAREERS_URL&&n===2?mode==='text'?text.replace('With diverse businesses and role requirements','With changed businesses and role requirements'):text.replace('mailto:Gr*********************@**********in.com','mailto:changed@edelweissfin.com'):text)
  await assert.rejects(run({fetchImpl}),/Closing.*changed/)
 }
})
test('Edelweiss changing opaque publisher cipher remains retained as unqualified contact data rather than pretending the complete contact model reconciles',async()=>{
 const {fetchImpl}=replay((row,text,n)=>row.url===CAREERS_URL&&n===2?text.replace(/data-original-string=("[^"]*"|'[^']*')/g,'data-original-string="native-next-cipher"'):text),jobs=await run({fetchImpl}),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(audit.observedRecordCount,1);assert.equal(audit.observedVacancyCount,0);assert.equal(audit.opaqueContactClosingQualified,false);assert.equal(audit.activeApplyVerified,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.notEqual(audit.nativeOpening.career.nativeContact.attrs['data-original-string'],audit.nativeClosing.career.nativeContact.attrs['data-original-string'])
})
test('Edelweiss canonical and body-only metadata boundaries remain strict',async()=>{
 assert.throws(()=>readCurrentEdelweiss(body(original(ROOT_URL)).replace('href="https://www.edelweissfin.com/"','href="https://foreign.invalid/"'),ROOT_URL),/canonical/)
 let calls=0;await assert.rejects(run({fetchText:async()=>{calls++}}),/Original HTTP metadata/);assert.equal(calls,0)
})
test('Edelweiss original403 and202 WAF challenge stop before body reads or alternate-source acquisition',async()=>{
 for(const status of [403,202]){let calls=0,reads=0
  await assert.rejects(run({fetchImpl:async url=>{calls++;return {status,url,headers:new Headers(status===202?{'x-amzn-waf-action':'challenge'}:{}),body:{getReader(){reads++;assert.fail('No denied body read')},cancel:async()=>{}}}}}),error=>error.httpStatus===status&&error.failureKind==='blocked_or_access_denied');assert.equal(calls,1);assert.equal(reads,0)
 }
})
test('Edelweiss frozen opaque in-flight caller cancellation survives fulfilled and rejected fetches exactly',async()=>{
 for(const mode of ['fulfil','reject']){const controller=new AbortController(),reason=Object.freeze({owner:'edelweiss-'+mode});let calls=0
  await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{calls++;controller.abort(reason);if(mode==='reject')throw Error('transport');return Object.defineProperty(new Response('opaque'),'url',{value:url})}}),error=>error===reason);assert.equal(calls,1)
 }
})

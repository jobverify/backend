import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {SOURCE,COMPANY,HOMEPAGE_URL,ABOUT_URL,createMozarkScraper,run} from './script.js'
import {PROGRAM_URL,readCurrentMozarkShell,readCurrentMozarkAbout} from './currentNative20261117.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
const original=url=>fixture.responses.find(r=>r.url===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
function replay(edit=(row,text)=>text){const calls=[],counts=new Map();return {calls,fetchImpl:async(url,init)=>{const row=original(url);assert.ok(row,'Only actual own declaration/observed redirect target '+url);calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const count=(counts.get(url)??0)+1;counts.set(url,count);return Object.defineProperty(new Response(edit(row,body(row),count),{status:row.status,headers:row.headers}),'url',{value:row.url})}}}
test('Mozark current shell declares its complete own root programme and its independent About document retains exact brand and redirect-admission limits',()=>{
 assert.equal(SOURCE,'mozark');assert.equal(COMPANY,'Mozark')
 const shell=readCurrentMozarkShell(body(original(HOMEPAGE_URL))),about=readCurrentMozarkAbout(body(original(ABOUT_URL)))
 assert.equal(shell.moduleDeclaration.attrs.src,'/site/assets/index-COF7qz_J.js');assert.equal(shell.nativeInventoryQualified,false);assert.equal(about.redirectReconciledInCurrentRun,false);assert.equal(about.corporateOfficesAreRoleCountries,false);assert.equal(about.genericContactOrDemoIsVacancy,false)
 assert.equal(about.wholeOriginalHTML,body(original(ABOUT_URL)))
})
test('Mozark full current corporate/client models and explicit coverage-gap receipt preserve unknown inventory without crawling speculative career,ERP or auth routes',async()=>{
 const {calls,fetchImpl}=replay(),jobs=await createMozarkScraper({fetchImpl}).run({maxJobs:1}),audit=jobs.nativeCollectionEvidence,inventory=readInventoryEvidence(jobs)
 assert.deepEqual(calls,[HOMEPAGE_URL,PROGRAM_URL,ABOUT_URL,HOMEPAGE_URL,PROGRAM_URL,ABOUT_URL]);assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,SOURCE).observedVacancyCount,0)
 assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)
 assert.equal(audit.activeApplyVerified,false);assert.equal(audit.legacyGuessedCareerRouteRequests,0);assert.ok(audit.nativeOpening.program.body.length>400000);assert.equal(audit.nativeOpening.about.wholeNativeBody.tag,'body')
})
test('Mozark changed native root programme declarations fail before accessing undeclared assets',async()=>{
 const {calls,fetchImpl}=replay((row,text)=>row.url===HOMEPAGE_URL?text.replace('/site/assets/index-COF7qz_J.js','https://foreign.invalid/new.js'):text)
 await assert.rejects(run({fetchImpl}),/declaration changed/);assert.equal(calls.length,1)
})
test('Mozark complete reviewed programme context rejects executable changes and public role/criteria additions rather than ignoring new data',async()=>{
 for(const addition of [';globalThis.UNREVIEWED_MOZARK=true',';const addedRoles=[{title:"New role",country:"India",criteria:"Changed requirement"}]']){
  const {calls,fetchImpl}=replay((row,text)=>row.url===PROGRAM_URL?text+addition:text)
  await assert.rejects(run({fetchImpl}),/Whole reviewed native root programme/);assert.equal(calls.length,2)
 }
 assert.equal(globalThis.UNREVIEWED_MOZARK,undefined)
})
test('Mozark whole current About body closing rejects passive native changes and requires its own current identity',async()=>{
 const {fetchImpl}=replay((row,text,count)=>row.url===ABOUT_URL&&count===2?text.replace('</body>','<aside>Additional native requirement</aside></body>'):text)
 await assert.rejects(run({fetchImpl}),/Closing.*native models changed/)
 assert.throws(()=>readCurrentMozarkAbout(body(original(ABOUT_URL)).replace('<title>Mozark.ai</title>','<title>Other company</title>')),/identity/)
})
test('Mozark metadata-only callbacks are unqualified and frozen pre-abort precedes invalid limits',async()=>{
 let calls=0;await assert.rejects(run({fetchText:async()=>{calls++}}),/Original HTTP metadata/);assert.equal(calls,0)
 const controller=new AbortController(),reason=Object.freeze({owner:'mozark-preabort'});controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,maxJobs:0,fetchText:async()=>{calls++}}),error=>error===reason);assert.equal(calls,0)
})
test('Mozark fulfilled and rejected in-flight cancellation preserve exact frozen caller ownership',async()=>{
 for(const mode of ['fulfil','reject']){const controller=new AbortController(),reason=Object.freeze({owner:'mozark-'+mode});let calls=0
  await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{calls++;controller.abort(reason);if(mode==='reject')throw Error('transport');return Object.defineProperty(new Response('opaque'),'url',{value:url})}}),error=>error===reason);assert.equal(calls,1)
 }
})
test('Mozark native202 WAF challenge stops at headers with no guessed source replacement',async()=>{
 let calls=0,reads=0
 await assert.rejects(run({fetchImpl:async url=>{calls++;return {status:202,url,headers:new Headers({'x-amzn-waf-action':'challenge'}),body:{getReader(){reads++;assert.fail('No challenge body read')},cancel:async()=>{}}}}}),error=>error.httpStatus===202&&error.failureKind==='blocked_or_access_denied');assert.equal(calls,1);assert.equal(reads,0)
})

import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {HOMEPAGE_URL,CAREERS_URL,run} from './script.js'
import {readCurrentErelego} from './currentNative20261117.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
const original=url=>fixture.responses.find(r=>r.url===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
function replay(edit=(row,text)=>text){const calls=[],counts=new Map();return {calls,fetchImpl:async(url,init)=>{const row=original(url);assert.ok(row);calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const n=(counts.get(url)??0)+1;counts.set(url,n);return Object.defineProperty(new Response(edit(row,body(row),n),{status:row.status,headers:row.headers}),'url',{value:row.url})}}}
test('eReleGo current full native career model retains named testimonial positions and distinct protected recruitment declarations without turning them into jobs',()=>{
 const model=readCurrentErelego(body(original(CAREERS_URL)),CAREERS_URL)
 assert.equal(model.wholeCareerLanding.attrs['data-elementor-id'],'4000');assert.ok(model.careerText.includes('Senior Executive React Developer'));assert.ok(model.careerText.includes('Graphic Designer'))
 assert.equal(model.employeeTestimonialsAreVacancies,false);assert.equal(model.corporateIndiaIsRoleCountry,false);assert.equal(model.publicApplicationEligibilityQualified,false);assert.equal(model.protectedContactDecoded,false)
 assert.ok(model.nativeCVInstruction&&model.nativeApplyDeclaration);assert.equal(model.nativeApplyDeclaration.children.some(n=>typeof n==='object'),true)
})
test('eReleGo direct nested and array/URI JobPosting declarations cannot become a zero-vacancy receipt',()=>{
 for(const model of [{'@type':'JobPosting'},{'@graph':[{'@type':'JobPosting'}]},[{'@type':['Thing','https://schema.org/JobPosting']}]] )assert.throws(()=>readCurrentErelego(body(original(CAREERS_URL)).replace('</head>','<script type="application/ld+json">'+JSON.stringify(model)+'</script></head>'),CAREERS_URL),/JobPosting/)
})
test('eReleGo complete observed career text including testimonial context rejects closing drift',async()=>{
 const {fetchImpl}=replay((row,text,n)=>row.url===CAREERS_URL&&n===2?text.replace('Some workplaces become more than a part of your career','Some workplaces add a changed native requirement to your career'):text)
 await assert.rejects(run({fetchImpl}),/Closing.*changed/)
})
test('eReleGo opaque protected contact changes stay raw and unqualified with no inferred application or India jobs',async()=>{
 const {fetchImpl}=replay((row,text,n)=>row.url===CAREERS_URL&&n===2?text.replace(/data-cfemail="[a-f0-9]+"/g,'data-cfemail="0001020304"'):text),jobs=await run({fetchImpl}),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(audit.observedRecordCount,1);assert.equal(audit.observedVacancyCount,0);assert.equal(audit.opaqueContactClosingQualified,false);assert.equal(audit.observations[0].country,null);assert.equal(audit.observations[0].jobId,null);assert.equal(audit.observations[0].applyUrl,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('eReleGo own employer/canonical, native detail-link changes and original metadata requirements remain mandatory',async()=>{
 const home=body(original(HOMEPAGE_URL));assert.throws(()=>readCurrentErelego(home.replace('href="https://erelego.com/"','href="https://foreign.invalid/"'),HOMEPAGE_URL),/canonical/)
 assert.throws(()=>readCurrentErelego(body(original(CAREERS_URL))+'<a href="/career/new-native-role">Current role</a>',CAREERS_URL),/role detail links/)
 let calls=0;await assert.rejects(run({fetchText:async()=>{calls++}}),/Original HTTP metadata/);assert.equal(calls,0)
})
test('eReleGo original403 and202 WAF challenge preserve header evidence and stop acquisition',async()=>{
 for(const status of [403,202]){let calls=0,reads=0
  await assert.rejects(run({fetchImpl:async url=>{calls++;return {status,url,headers:new Headers(status===202?{'x-amzn-waf-action':'challenge'}:{}),body:{getReader(){reads++;assert.fail('No denied body read')},cancel:async()=>{}}}}}),error=>error.httpStatus===status&&error.failureKind==='blocked_or_access_denied');assert.equal(calls,1);assert.equal(reads,0)
 }
})
test('eReleGo fulfilled and rejected in-flight cancellation preserve exact frozen caller reason',async()=>{
 for(const mode of ['fulfil','reject']){const controller=new AbortController(),reason=Object.freeze({owner:'erelego-'+mode});let calls=0
  await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{calls++;controller.abort(reason);if(mode==='reject')throw Error('transport');return Object.defineProperty(new Response('opaque'),'url',{value:url})}}),error=>error===reason);assert.equal(calls,1)
 }
})

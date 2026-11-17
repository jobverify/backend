import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from '../../scraper/rssoftwareindia/script.js'
import {sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/rssoftwareindia/fixtures/native-20261117.json.gz',import.meta.url))))
const row=url=>fixture.responses.find(r=>(r.url??r.finalUrl)===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
function replay(edit=(r,text)=>text){const counts=new Map(),calls=[];return {calls,fetchImpl:async(url,init)=>{const r=row(url);assert.ok(r,'No actual source original for '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const n=(counts.get(url)??0)+1;counts.set(url,n);calls.push(url);return Object.defineProperty(new Response(edit(r,body(r),n),{status:r.status,headers:r.headers}),'url',{value:r.url??r.finalUrl})}}}
import {HOMEPAGE_URL,CAREERS_URL,readCurrentRsSoftware,readCurrentRsSoftwareListing,readCurrentRsSoftwareDetail} from '../../scraper/rssoftwareindia/currentNative20261117.js'
const listing=()=>readCurrentRsSoftwareListing(readCurrentRsSoftware(body(row(CAREERS_URL)),CAREERS_URL)),card=id=>listing().cards.find(c=>c.roleId===id),detail=id=>{const c=card(id);return readCurrentRsSoftwareDetail(readCurrentRsSoftware(body(row(c.detailUrl)),c.detailUrl),c)}
test('RS Software actual post-date spans preserve historical publisher dates together with full native descriptions and own role form binding',()=>{
 const one=detail('2'),two=detail('55');assert.equal(one.nativePublishedDateModel[0]?.text,'February 21, 2024');assert.equal(two.nativePublishedDateModel[0]?.text,'May 13, 2026');assert.ok(one.jobDescription.includes('EMV certification'));assert.ok(two.jobDescription.length>4000)
 for(const r of [one,two]){assert.equal(r.country,null);assert.equal(r.workCountryQualified,false);assert.equal(r.wholeNativeApplicationForm.attrs.action,'https://rssoftware.ai/home/submit_application');assert.equal(r.sourceNativeApplicationFields.find(n=>n.attrs.name==='job_details_id').attrs.value,r.roleId);assert.ok(r.sourceNativeApplicationFields.some(n=>n.tag==='textarea'&&Object.hasOwn(n.attrs,'required')));assert.equal(r.publicApplicationEligibilityQualified,false)}
})
test('RS Software current two dynamic active native cards exclude commented historic cohorts and testimonial roles',()=>{
 const roles=listing();assert.deepEqual(roles.cards.map(c=>c.roleId),['2','55']);assert.equal(roles.cards.length,2);const changed=body(row(CAREERS_URL)).replace('/Home/job_details/55','/Home/job_details/999');assert.equal(readCurrentRsSoftwareListing(readCurrentRsSoftware(changed,CAREERS_URL)).cards[1].roleId,'999')
})
test('RS Software unbound detail application ID, foreign native role handoff and employer/title guards fail closed',()=>{
 const c=card('2'),html=body(row(c.detailUrl));assert.throws(()=>readCurrentRsSoftwareDetail(readCurrentRsSoftware(html.replace(/(name="job_details_id"\s+value=")2(")/,'$19001$2'),c.detailUrl),c),/identity/)
 assert.throws(()=>readCurrentRsSoftwareListing(readCurrentRsSoftware(body(row(CAREERS_URL)).replace('https://rssoftware.ai/Home/job_details/2','https://foreign.invalid/Home/job_details/2'),CAREERS_URL)),/Unbound/)
 assert.throws(()=>readCurrentRsSoftware(body(row(HOMEPAGE_URL)).replace('<title>RS SOFTWARE</title>','<title>Other Employer</title>'),HOMEPAGE_URL),/employer/)
})
test('RS Software whole closing native job criteria and form models reject materially changed authored requirements',async()=>{
 const {fetchImpl}=replay((r,text,n)=>r.url.endsWith('/Home/job_details/2')&&n===2?text.replaceAll('10+ years of experience','11+ years of experience'):text);await assert.rejects(run({fetchImpl}),/Closing whole native role/)
})
test('RS Software actual acquisition retains two vacancies with unknown work countries and cleanup held',async()=>{
 const jobs=await run(replay());assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,2);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('RS Software original403 and202 WAF priority preserve native denial before any body read without alternate requests',async()=>{
 for(const status of [403,202]){let calls=0,reads=0;await assert.rejects(run({fetchImpl:async url=>{calls++;return {status,url,headers:new Headers(status===202?{'x-amzn-waf-action':'challenge'}:{}),body:{getReader(){reads++;assert.fail('No denied entity consumption')},cancel:async()=>{}}}}}),e=>e.httpStatus===status&&e.failureKind==='blocked_or_access_denied');assert.equal(calls,1);assert.equal(reads,0)}
})
test('RS Software body-only callback cannot qualify native acquisition and fulfilled/rejected opaque caller abort keeps exact frozen owner reason',async()=>{
 let calls=0;await assert.rejects(run({fetchText:async()=>{calls++;assert.fail('Body-only callback must not run')}}),/Original HTTP metadata/);assert.equal(calls,0)
 for(const mode of ['fulfil','reject']){const controller=new AbortController(),reason=Object.freeze({owner:'RS Software-'+mode});await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{controller.abort(reason);if(mode==='reject')throw Error('transport');return Object.defineProperty(new Response('opaque'),'url',{value:url})}}),e=>e===reason)}
})

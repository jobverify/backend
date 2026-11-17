import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
const row=url=>fixture.responses.find(r=>(r.url??r.finalUrl)===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
function replay(edit=(r,text)=>text){const counts=new Map(),calls=[];return {calls,fetchImpl:async(url,init)=>{const r=row(url);assert.ok(r,'No actual source original for '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const n=(counts.get(url)??0)+1;counts.set(url,n);calls.push(url);return Object.defineProperty(new Response(edit(r,body(r),n),{status:r.status,headers:r.headers}),'url',{value:r.url??r.finalUrl})}}}
import {HOMEPAGE_URL,CAREERS_URL,readCurrentSgbi,readCurrentSgbiListing,readCurrentSgbiDetail} from './currentNative20261117.js'
const openingModel=()=>readCurrentSgbiListing(readCurrentSgbi(body(row(CAREERS_URL)),CAREERS_URL)),card=id=>openingModel().cards.find(c=>c.roleId===id),detail=id=>{const c=card(id);return readCurrentSgbiDetail(readCurrentSgbi(body(row(c.detailUrl)),c.detailUrl),c)}
test('SGBI full native criteria/schema and all application fields retain literal job country and historical native dates without corporate country inference',()=>{
 const india=detail('5278'),cochin=detail('5639');assert.equal(india.country,'India');assert.equal(cochin.country,null);assert.equal(cochin.location,'Cochin');assert.equal(india.postingDate,'2025-08-02T04:23:54+00:00');assert.equal(india.closingDate,null)
 assert.ok(india.jobDescription.includes('32-bit microcontrollers'));assert.ok(india.jobDescription.includes('By using this form'));assert.ok(india.sourceNativeApplicationFields.some(n=>n.tag==='textarea'));assert.ok(india.sourceNativeApplicationFields.some(n=>n.attrs.name==='awsm_nonce'));assert.equal(india.wholeNativePublicConfiguration.job_id,'5278');assert.equal(india.publicApplicationEligibilityQualified,false)
 assert.ok(cochin.wholeNativeJobPosting.description.includes('About Company'));assert.ok(cochin.wholeNativeDescription);assert.ok(cochin.wholeOriginalHTML.length>100000)
})
test('SGBI complete actual source cohort is dynamic rather than seven frozen role titles or IDs',()=>{
 const m=readCurrentSgbi(body(row(CAREERS_URL)),CAREERS_URL),listing=readCurrentSgbiListing(m),first=listing.cards[0].wholeNativeCard,html=body(row(CAREERS_URL)),at=html.indexOf('id="awsm-list-item-'+listing.cards[0].roleId+'"');assert.ok(at>0);assert.ok(first)
 const changed=html.replace('id="awsm-list-item-5639"','id="awsm-list-item-9001"');assert.equal(readCurrentSgbiListing(readCurrentSgbi(changed,CAREERS_URL)).cards[0].roleId,'9001');assert.equal(listing.cards.length,7)
})
test('SGBI native employer, ID, country agreement and complete rendered/structured eligibility remain mandatory',()=>{
 const c=card('5278'),html=body(row(c.detailUrl))
 for(const mutate of [s=>s.replace('"name":"SGBI"','"name":"Other Employer"'),s=>s.replace('name="awsm_job_id" value="5278"','name="awsm_job_id" value="9001"'),s=>s.replace('"address":"India"','"address":"United States"'),s=>s.replace('Worked on 32-bit microcontrollers','Worked on 64-bit microcontrollers')])assert.throws(()=>readCurrentSgbiDetail(readCurrentSgbi(mutate(html),c.detailUrl),c),/identity|locations disagree|criteria disagree/)
 const home=body(row(HOMEPAGE_URL));assert.throws(()=>readCurrentSgbi(home.replace('href="https://sgbi.us/"','href="https://foreign.invalid/"'),HOMEPAGE_URL),/canonical/)
})
test('SGBI full closing native role criteria and application constraints reject changed native authored requirements',async()=>{
 const {fetchImpl}=replay((r,text,n)=>r.url.endsWith('/embedded-software-engineer/')&&n===2?text.replaceAll('Worked on 32-bit microcontrollers','Worked on 64-bit microcontrollers'):text);await assert.rejects(run({fetchImpl}),/Closing complete native role/)
})
test('SGBI closing app field change cannot publish stale native eligibility and positive result retains unknown company scope',async()=>{
 const {fetchImpl}=replay((r,text,n)=>r.url.endsWith('/embedded-software-engineer/')&&n===2?text.replace('accept=".pdf, .doc, .docx"','accept=".pdf"'):text);await assert.rejects(run({fetchImpl}),/form contract|Closing/)
 const jobs=await run(replay());assert.equal(jobs.length,1);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs[0].remoteStatus,null);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})

test('SGBI original403 and202 WAF priority preserve native denial before any body read without alternate requests',async()=>{
 for(const status of [403,202]){let calls=0,reads=0;await assert.rejects(run({fetchImpl:async url=>{calls++;return {status,url,headers:new Headers(status===202?{'x-amzn-waf-action':'challenge'}:{}),body:{getReader(){reads++;assert.fail('No denied entity consumption')},cancel:async()=>{}}}}}),e=>e.httpStatus===status&&e.failureKind==='blocked_or_access_denied');assert.equal(calls,1);assert.equal(reads,0)}
})
test('SGBI body-only callback cannot qualify native acquisition and fulfilled/rejected opaque caller abort keeps exact frozen owner reason',async()=>{
 let calls=0;await assert.rejects(run({fetchText:async()=>{calls++;assert.fail('Body-only callback must not run')}}),/Original HTTP metadata/);assert.equal(calls,0)
 for(const mode of ['fulfil','reject']){const controller=new AbortController(),reason=Object.freeze({owner:'SGBI-'+mode});await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{controller.abort(reason);if(mode==='reject')throw Error('transport');return Object.defineProperty(new Response('opaque'),'url',{value:url})}}),e=>e===reason)}
})

test('SGBI newly published closing or applicant qualification schema fields require native review before emitting a role',()=>{
 const c=card('5278'),html=body(row(c.detailUrl))
 for(const [key,value] of [['validThrough','2026-11-01T00:00:00Z'],['qualifications','A newly published mandatory certification'],['applicantLocationRequirements',{'@type':'Country',name:'United States'}]]){const changed=html.replace('"datePosted":',JSON.stringify(key)+':'+JSON.stringify(value)+',"datePosted":');assert.notEqual(changed,html);assert.throws(()=>readCurrentSgbiDetail(readCurrentSgbi(changed,c.detailUrl),c),/schema field|unreviewed/i)}
})

test('SGBI target relationship is explicit in current own legal organization and Sastra copyright rather than social handles',()=>{
 const html=body(row(HOMEPAGE_URL)),m=readCurrentSgbi(html,HOMEPAGE_URL);assert.equal(m.nativeSastraRelationship.nativeLegalName,'SGBI Inc');assert.ok(m.nativeSastraRelationship.nativeOrganizationDescription.includes('began in 2013 with Sastra Robotics.'));assert.ok(m.nativeSastraRelationship.nativeCopyrightText.includes('SGBI Inc | Sastra Robotics | All Right Reserved'));assert.equal(m.nativeSastraRelationship.relationshipQualified,true)
 assert.throws(()=>readCurrentSgbi(html.replaceAll('SGBI Inc | Sastra Robotics | All Right Reserved','SGBI Inc | Other Group | All Right Reserved'),HOMEPAGE_URL),/Sastra.*relationship|relationship.*Sastra/i)
})

test('SGBI unreviewed nested native location or employer qualification fields cannot be ignored',()=>{
 const c=card('5278'),html=body(row(c.detailUrl));for(const [before,after]of [['"address":"India"','"address":"India","addressCountry":"United States"'],['"sameAs":"https:\\/\\/sgbi.us"','"sameAs":"https:\\/\\/sgbi.us","qualifications":"New mandatory credential"']]){const changed=html.replace(before,after);assert.notEqual(changed,html);assert.throws(()=>readCurrentSgbiDetail(readCurrentSgbi(changed,c.detailUrl),c),/schema field|unreviewed/i)}
})

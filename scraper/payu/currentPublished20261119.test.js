import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,createPayUScraper} from './script.js'
import {readPayUListing,readPayURole} from './currentPublished20261119.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-publication-20261119.json.gz',import.meta.url)))),text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8'),at=fixture.observedAt
const board='https://careers.payu.in/PayU/go/_/514880/',first=()=>readPayUListing(text(fixture.responses.find(p=>p.requestedUrl===board)),board).rows[0]
const append=(html,extra)=>{const d=document(html),n=d.nodes(n=>n.attrs.itemprop==='description')[0];assert.ok(n);return html.slice(0,n.openEnd)+extra+html.slice(n.openEnd)}
const replay=async(change,factory=false)=>{const counts=new Map(),calls=[],saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Native Response callback must reach the actual current production factory')};try{const options={now:()=>at,requestIntervalMs:0,maxRoleDetails:3,fetchImpl:async(url,init)=>{calls.push(url);assert.equal(init.credentials,'omit');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');const n=counts.get(url)||0;counts.set(url,n+1);const rows=fixture.responses.filter(p=>p.requestedUrl===url),p=rows[n]??rows[0];assert.ok(p,'Only actual declared native requests '+url);const changed=change?.(text(p),url,n),packet=typeof changed==='object'?changed:{body:changed??text(p),status:p.status};const response=Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers??p.headers}),'url',{value:p.url});if(packet.redirected!=null)Object.defineProperty(response,'redirected',{value:packet.redirected});return response}};const jobs=await(factory?createPayUScraper().run(options):run(options));return{jobs,calls}}finally{globalThis.fetch=saved}}
test('PayU current production entry and factory follow actual own corporate redirects and dynamic native pages without frozen UI or vacancy hashes',async()=>{for(const factory of [false,true]){const {jobs,calls}=await replay(undefined,factory);assert.equal(jobs.length,3);assert.ok(jobs.every(j=>j.company==='PayU'&&j.nativeEmployerDisplayName==='PayU Payments'&&j.country==='India'&&j.sourceDetailComplete===false&&j.sourceClosingQualified&&!j.lifecycleCleanupAllowed));assert.equal(jobs.nativeCollectionEvidence.openingNativeRecords.length,143);assert.ok(calls.some(u=>u.includes('/125/')));assert.equal(jobs[0].jobId,first().jobId);assert.equal(jobs[0].postingDate,'2026-11-19T02:00:00.000Z');assert.ok(jobs[0].sourceDescription.length>100)}})
test('PayU same-role native employer, whole India workplace, authored closure, deadline and foreign placement override stale India labels',()=>{const row=first(),html=text(fixture.responses.find(p=>p.requestedUrl===row.sourceUrl));for(const value of ['<div>Employer: Other Company</div>','<div>Closing Date: 2020-01-01</div>','<p>Job Status: Draft</p>','This position has been filled.','<p>Location: London (Europe based candidates only)</p>'])assert.throws(()=>readPayURole(append(html,value),row,at));assert.throws(()=>readPayURole(html.replaceAll('content="Bengaluru, IN"','content="Toronto, CA"'),row,at));assert.throws(()=>readPayURole(html.replaceAll('content="PayU Payments"','content="Another Company"'),row,at))})
test('PayU retains actually observed partial criteria and original dates on optional closing failure',async()=>{const url=first().sourceUrl,{jobs}=await replay((body,u,n)=>u===url&&n===1?{body:'Unavailable',status:503}:body);assert.equal(jobs.length,3);assert.equal(jobs[0].sourceNativeRoleDetailClosingQualified,false);assert.ok(jobs[0].sourceDescription);assert.equal(jobs[0].postingDate,'2026-11-19T02:00:00.000Z')})
test('PayU wrong-role application and closing publication drift cannot become a company zero',async()=>{const row=first();assert.throws(()=>readPayURole(text(fixture.responses.find(p=>p.requestedUrl===row.sourceUrl)).replaceAll('/talentcommunity/apply/'+row.jobId+'/', '/talentcommunity/apply/1/'),row,at));const {jobs}=await replay((body,u,n)=>u===board&&n===1?body.replaceAll(row.title,'Changed native title'):body);assert.equal(jobs.length,2);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)})

test('PayU current corporate redirects, original response identity and HTML MIME cannot be replaced by an unrelated publisher',async()=>{
  await assert.rejects(replay((body,u)=>u==='https://corporate.payu.in/careers/'?{body,status:301,headers:{location:'https://other.example/careers'}}:body),/corporate redirect changed/)
  await assert.rejects(replay((body,u)=>u===board?{body,status:200,headers:{'content-type':'application/json'}}:body),/HTML MIME/)
  await assert.rejects(replay((body,u)=>u===board?{body,status:200,redirected:true}:body),/HTTP identity/)
})
test('PayU body-only transport and caller cancellation cannot bypass native publication qualification',async()=>{await assert.rejects(run({fetchText:async()=>''}),/metadata|transport/);const c=new AbortController(),reason={caller:'PayU'};c.abort(reason);await assert.rejects(run({signal:c.signal}),e=>e===reason)})

test('PayU whole own JobPosting labels outside description and explained draft status remain authoritative',()=>{
 const row=first(),html=text(fixture.responses.find(p=>p.requestedUrl===row.sourceUrl)),d=document(html),owner=d.nodes(n=>n.attrs.itemtype?.endsWith('/JobPosting'))[0]
 for(const extra of ['<div>Job Status: Draft</div>','<div>Company: Other Company</div>','<div>Closing Date: 2020-01-01</div>','<div>Country: Canada</div>'])assert.throws(()=>readPayURole(html.slice(0,owner.closeStart)+extra+html.slice(owner.closeStart),row,at))
 assert.throws(()=>readPayURole(append(html,'<div>Job Status: Draft (not published)</div>'),row,at))
 const mixed='Toronto, Canada / '+row.locations[0];assert.throws(()=>readPayURole(html.replaceAll('content="'+row.locations[0]+'"','content="'+mixed+'"'),{...row,locations:[mixed]},at))
})

test('PayU genuine duplicate India address publications preserve native multiplicity as an explicit partial',()=>{
 const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-duplicate-workplaces-20261119.json.gz',import.meta.url)))),job=readPayURole(Buffer.from(f.originalRoleResponse.bodyBase64,'base64').toString('utf8'),f.listingRecord,f.observedAt)
 assert.deepEqual(job.sourceNativeWorkplaces,['Bengaluru, IN','Bengaluru, IN']);assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,false)
 assert.deepEqual(job.sourceNativeWorkplaceMultiplicity,{publishedAddressCount:2,distinctAddressCount:1,listingAdditionalLocationCount:1,distinctAdditionalWorkplacesVerified:false})
})

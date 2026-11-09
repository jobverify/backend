import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from '../../scraper/lexmarkinternational/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const fixture=JSON.parse(fs.readFileSync(new URL('../../scraper/lexmarkinternational/fixtures/native-20261029.json',import.meta.url)))
const options={now:()=>fixture.checkedAt,retryBaseDelayMs:0,requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){},minIntervalMs:0}}
const soleHandoff = packet => {
 if(packet.url.includes('lexmark.com/'))packet.body=packet.body.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi,anchor=>/href="https:\/\/lexmark\.wd1\.myworkdayjobs\.com\/Lexmark"/.test(anchor)?anchor:'')
}
function transport(t,change=()=>{},packets=fixture.packets){const calls=[];t.mock.method(globalThis,'fetch',async(url,init={})=>{init.signal?.throwIfAborted();url=String(url);const packet=structuredClone(packets.find(p=>p.url===url&&p.method===(init.method||'GET')&&p.requestBody===(init.body||null)));assert.ok(packet,'Unexpected native request '+url);change(packet,calls);calls.push({url,body:init.body});const r=new Response(packet.body,{status:packet.status,headers:{'content-type':packet.contentType}});Object.defineProperty(r,'url',{value:packet.finalUrl});return r});return calls}
test('current Lexmark native zero retains explicit unresolved Xerox hiring scope',async t=>{transport(t);const jobs=await run(options);assert.equal(jobs.length,0);const e=readInventoryEvidence(jobs);assert.ok(e,'Empty arrays must carry inventory evidence');assert.equal(e.listingComplete,false);assert.equal(e.indiaFacetCount,null);assert.match(e.reason,/additional-advertised-hiring-inventory/)} )

test('closed native zero requires raw opening/closing plus engine and union rechecks',async t=>{let audit;const calls=transport(t);await run({...options,onAudit:a=>audit=a});assert.equal(calls.filter(c=>c.body).length,5);assert.equal(audit.rawOpening.total,0);assert.equal(audit.rawClosing.total,0);assert.equal(audit.nativeCount,0);assert.equal(audit.nativeBoards[0].explicitGlobalEmpty,true);assert.equal(audit.nativeBoards[0].reconciliation.initial.count,0);assert.equal(audit.nativeBoards[0].reconciliation.closing.count,0);assert.equal(audit.complete,false)})
test('removing reviewed active careers channels requires review before source promotion',async t=>{transport(t,soleHandoff);const jobs=await run(options);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null);assert.match(readInventoryEvidence(jobs).reason,/unreviewed-corporate-script-form-or-handler-surface/)})
for(const [label,change] of [
 ['hidden handoff',p=>{if(p.url.includes('lexmark.com/'))p.body=p.body.replaceAll('>Search all jobs<',' hidden>Search all jobs<').replaceAll('href="https://lexmark.wd1.myworkdayjobs.com/Lexmark"','hidden href="https://lexmark.wd1.myworkdayjobs.com/Lexmark"')}],
 ['wrong corporate response URL',p=>{if(p.url.includes('lexmark.com/'))p.finalUrl='https://other.example/careers'}],
 ['wrong corporate content type',p=>{if(p.url.includes('lexmark.com/'))p.contentType='application/json'}],
 ['foreign board bootstrap',p=>{if(p.url.endsWith('/Lexmark'))p.body=p.body.replaceAll('tenant: "lexmark"','tenant: "another"')}],
 ['native error envelope',p=>{if(p.method==='POST')p.body='{"total":0,"jobPostings":[],"error":"blocked"}'}],
 ['incomplete empty envelope',p=>{if(p.method==='POST')p.body='{"total":1,"jobPostings":[]}'}],
 ['changed closing count',(p,calls)=>{if(p.method==='POST'&&calls.filter(c=>c.body).length)p.body='{"total":1,"jobPostings":[]}'}],
])test('rejects '+label,async t=>{transport(t,change);await assert.rejects(run(options))})
test('caps cannot turn a truncated source into certified empty',async t=>{transport(t);await assert.rejects(run({...options,maxJobs:1}),/caps/);await assert.rejects(run({...options,maxPages:1}),/caps/)})
test('abort cannot return empty evidence',async t=>{const calls=transport(t);await assert.rejects(run({...options,signal:AbortSignal.abort()}));assert.equal(calls.length,0)})
test('body-only legacy injection is explicitly rejected before any network',async t=>{const calls=transport(t);await assert.rejects(run({...options,fetchText:async()=>''}),/body-only/);await assert.rejects(run({...options,fetchJson:async()=>({})}),/body-only/);assert.equal(calls.length,0)})

const futureIndia=()=>{
 const packets=structuredClone(fixture.packets),externalPath='/job/Bengaluru-India/Software-Engineer_R1234',base='https://lexmark.wd1.myworkdayjobs.com/Lexmark'
 const row={title:'Software Engineer',externalPath,locationsText:'Bengaluru, India',bulletFields:['R1234'],postedOn:'Posted Today'}
 packets.find(p=>p.method==='POST').body=JSON.stringify({total:1,jobPostings:[row],facets:[],userAuthenticated:false})
 const country={descriptor:'India',alpha2Code:'IN',id:'c4f78be1a8f14da0ab49ce1162348a5e'}
 const payload={jobPostingInfo:{id:'1234567890abcdef1234567890abcdef',title:'Software Engineer',jobReqId:'R1234',jobPostingId:'Software-Engineer_R1234',jobPostingSiteId:'Lexmark',externalUrl:base+externalPath,canApply:true,posted:true,location:'Bengaluru, India',country:{descriptor:'India',id:country.id},jobRequisitionLocation:{descriptor:'Bengaluru, India',country},jobDescription:'<p>Build reliable backend services for enterprise print workflows and customer-facing applications.</p><h2>Requirements</h2><p>Strong JavaScript skills and experience operating distributed systems. Collaborate with engineers to maintain quality.</p>',startDate:'2026-10-20',timeType:'Full time'},hiringOrganization:{name:'Lexmark International, Inc.'}}
 packets.push({url:'https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark'+externalPath,method:'GET',requestBody:null,status:200,finalUrl:'https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark'+externalPath,contentType:'application/json',body:JSON.stringify(payload)})
 return packets
}
test('future native India roles retain full criteria and partial source markers',async t=>{transport(t,()=>{},futureIndia());const jobs=await run(options);assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'R1234');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].company,'Lexmark International');assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.match(jobs[0].jobDescription,/Strong JavaScript skills/);assert.equal(jobs[0].postedAt,'2026-10-20T00:00:00.000Z')})
test('a native India label cannot override contradictory typed foreign country',async t=>{const packets=futureIndia(),d=packets.at(-1),payload=JSON.parse(d.body);payload.jobPostingInfo.jobRequisitionLocation.country={descriptor:'United States',alpha2Code:'US',id:'bc33aa3152ec42d4995f4791a106ed09'};d.body=JSON.stringify(payload);transport(t,()=>{},packets);await assert.rejects(run(options))})
test('foreign native employer cannot produce a Lexmark job',async t=>{const packets=futureIndia(),d=packets.at(-1),payload=JSON.parse(d.body);payload.hiringOrganization.name='Other Employer';d.body=JSON.stringify(payload);transport(t,()=>{},packets);await assert.rejects(run(options),/employer/)})

for(const [label,addition] of [['form','<form action="https://unreviewed.example/collect"><input name="resume"><button>Apply</button></form>'],['script','<script src="https://unreviewed.example/recruit.js"></script>']])test('a sole board handoff cannot certify empty with an unreviewed active '+label,async t=>{transport(t,p=>{soleHandoff(p);if(p.url.includes('lexmark.com/'))p.body+=addition});const jobs=await run(options);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(readInventoryEvidence(jobs).reason,/unreviewed-corporate-script-form-or-handler-surface/)})

for(const field of ['listing','detail','nested'])test('unreviewed '+field+' geography on a foreign role cannot certify India absence',async t=>{
 const packets=futureIndia(),listing=packets.find(p=>p.method==='POST'),payload=JSON.parse(listing.body),detail=packets.at(-1),d=JSON.parse(detail.body)
 payload.jobPostings[0].locationsText='Chicago, United States'
 if(field==='listing')payload.jobPostings[0].additionalCountries=['India']
 d.jobPostingInfo.location='Chicago, United States';d.jobPostingInfo.country={descriptor:'United States',alpha2Code:'US',id:'bc33aa3152ec42d4995f4791a106ed09'};d.jobPostingInfo.jobRequisitionLocation={descriptor:'Chicago, United States',country:{...d.jobPostingInfo.country}}
 if(field==='detail')d.jobPostingInfo.additionalCountries=['India']
 if(field==='nested')d.jobPostingInfo.remoteType={descriptor:'Remote',id:'native-remote',additionalCountries:['India']}
 listing.body=JSON.stringify(payload);detail.body=JSON.stringify(d);transport(t,soleHandoff,packets)
 const jobs=await run(options);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(readInventoryEvidence(jobs).reason,field==='nested'?/unreviewed-detail-nested-schema/:/unreviewed-(?:listing|detail)-role-schema/)
})
test('an unreviewed data attribute cannot hide an executable recruiting route',async t=>{transport(t,p=>{if(p.url.includes('lexmark.com/'))p.body+='<div data-hiring-url="https://unreviewed.example/jobs"></div>'});const jobs=await run(options);assert.match(readInventoryEvidence(jobs).reason,/unreviewed-corporate-script-form-or-handler-surface/)})
test('unreviewed native geography keeps a valid India role while blocking source promotion',async t=>{const packets=futureIndia(),listing=packets.find(p=>p.method==='POST'),payload=JSON.parse(listing.body);payload.jobPostings[0].additionalCountries=['Singapore'];listing.body=JSON.stringify(payload);transport(t,soleHandoff,packets);const jobs=await run(options);assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(readInventoryEvidence(jobs).reason,/unreviewed-listing-role-schema/)})

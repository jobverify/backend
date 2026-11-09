import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {validateCarrierDetail} from './nativeRun.js'
import {projectNativeWorkdayClocks} from '../../test/helpers/nativeWorkdayClockProjection.js'
import {carrierSearchPacket} from '../../test/helpers/carrierNativeSearch.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime-native-20261021.json.gz',import.meta.url))))
async function replay(change,options={}){
 const f=fixture(),original=globalThis.fetch;f.packets.push(carrierSearchPacket());let calls=0
 globalThis.fetch=async(url,init={})=>{const packet=f.packets.find(p=>p.url===String(url)&&p.requestBody===(init.body??null));assert.ok(packet,'Uncaptured native request '+url);const p=structuredClone(packet);change?.(p,++calls);const r=new Response(p.body,{status:p.status});Object.defineProperty(r,'url',{value:p.finalURL});return r}
 try{return await run({now:f.now,requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0},retryBaseDelayMs:0,...options})}finally{globalThis.fetch=original}
}
test('all53 native India country roles include cityless explicit-country office without inventing a city',async()=>{
 const jobs=await replay();assert.equal(jobs.length,53);const j=jobs.find(j=>j.requisitionId==='30219751');assert.equal(j.city,null);assert.equal(j.country,'India');assert.equal(j.location,'2nd Floor, IndiQube ARCADE, Subramanya ARCADE,Bannerghatta Road, Old Gurappanapalya, BTM Layout');assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.sourceListingComplete===false));assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('Carrier rejects a zero cap rather than returning a verified empty sentinel',async()=>{
 await assert.rejects(()=>run({maxJobs:0}),/truncated/)
})
test('Carrier requires a current successful official handoff before any native inventory',async()=>{
 await assert.rejects(()=>run({fetchPage:async url=>({status:200,url,body:'<html><title>Carrier</title><body>No current careers handoff</body></html>'})}),/binding/)
})
test('Carrier honours explicit zero timeout and an already aborted caller',async()=>{
 await assert.rejects(()=>run({timeoutMs:0}),/deadline/)
 const c=new AbortController();c.abort(Error('caller stopped'));await assert.rejects(()=>run({signal:c.signal}),/caller stopped/)
})
const detailChange=fn=>p=>{if(p.url.includes('/wday/cxs/')&&p.url.includes('/job/')){const j=JSON.parse(p.body);fn(j);p.body=JSON.stringify(j)}}
for(const [name,fn]of [
 ['uppercase failure',j=>{j.META={STATUS:500}}],['native numeric ID',j=>{j.jobPostingInfo.jobReqId=Number(j.jobPostingInfo.jobReqId)}],
 ['foreign structured country',j=>{j.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US'}],
 ['foreign primary country',j=>{j.jobPostingInfo.country={descriptor:'United States',id:'foreign'}}],
 ['foreign explicit address segment',j=>{j.jobPostingInfo.location='New York, United States, India'}],
 ['unknown secondary office',j=>{j.jobPostingInfo.additionalLocations=['Remote']}],
 ['wrong application identity',j=>{j.jobPostingInfo.externalUrl=j.jobPostingInfo.externalUrl.replace(/_\d+(?:-\d+)?$/,'_99999999')}],
 ['private/closed native status',j=>{j.jobPostingInfo.canApply=false}],['unknown legal employer',j=>{j.hiringOrganization.name='Unrelated Corp'}],
 ['future publication',j=>{j.jobPostingInfo.startDate='2099-01-01'}],['impossible calendar',j=>{j.jobPostingInfo.startDate='2026-02-30'}],
 ['hidden fullJD',j=>{j.jobPostingInfo.jobDescription='<div hidden>'+j.jobPostingInfo.jobDescription+'</div>'}],
 ['inert fullJD',j=>{j.jobPostingInfo.jobDescription='<div inert>'+j.jobPostingInfo.jobDescription+'</div>'}],
 ['closed notice instead of fullJD',j=>{j.jobPostingInfo.jobDescription='<p>This job is no longer available.</p>'}],
 ['CTA instead of fullJD',j=>{j.jobPostingInfo.jobDescription='<p>Click Apply Now to view the full job description.</p>'}],
])test('full ordinary wrapper rejects '+name,async()=>{await assert.rejects(()=>replay(detailChange(fn)))})
test('exact native pages reject duplicate IDs, primitive total errors and final inventory drift',async()=>{
 for(const mode of ['duplicate','total','drift']){let posts=0;await assert.rejects(()=>replay(p=>{if(p.method==='POST'){posts++;const j=JSON.parse(p.body);if(mode==='duplicate'&&posts===1)j.jobPostings[1]=structuredClone(j.jobPostings[0]);if(mode==='total')j.total=[j.total];if(mode==='drift'&&posts===4)j.jobPostings[0].title+=' changed';p.body=JSON.stringify(j)}}))}
})
test('HTTP202 and changed final response URL fail without producing an empty result',async()=>{for(const fn of [p=>{p.status=202},p=>{p.finalURL='https://example.invalid/'}])await assert.rejects(()=>replay(p=>{if(p.method==='POST')fn(p)}))})
test('caller cancellation after the final response remains a failed attempt',async()=>{const c=new AbortController();let posts=0;await assert.rejects(()=>replay(p=>{if(p.method==='POST'&&++posts===6)c.abort(Error('final response cancellation'))},{signal:c.signal}),/final response cancellation/)})
test('duplicate native posting UID across separate requisitions cannot qualify',async()=>{await assert.rejects(()=>replay(detailChange(j=>{j.jobPostingInfo.id='a'.repeat(32)})),/posting UID/)})
test('optional native primary country code must agree with typed India',async()=>{await assert.rejects(()=>replay(detailChange(j=>{j.jobPostingInfo.country.alpha2Code='US'})),/countries/)})
test('new native secondary office uses exact current primary India-country evidence, never a guessed city',()=>{
 const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/new-secondary-20261021.json.gz',import.meta.url)))),payload=JSON.parse(f.detail.body),row={row:f.listing,id:'30220599',url:payload.jobPostingInfo.externalUrl},office=payload.jobPostingInfo.additionalLocations[0]
 assert.throws(()=>validateCarrierDetail(payload,row,'2026-10-21T06:00:00Z',new Set()),/secondary/)
 const result=validateCarrierDetail(payload,row,'2026-10-21T06:00:00Z',new Set([office.replace(/\s+/g,' ').trim()]))
 assert.ok(result.locations.includes(office));assert.equal(result.city,null)
})
test('all68 archived HTTP receipts and current search discovery replay into exactly59 captured jobs with original native fields',async()=>{
 const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime-current59-20261021.json.gz',import.meta.url)))),used=new Set(),original=globalThis.fetch;f.packets.push(carrierSearchPacket())
 globalThis.fetch=async(url,init={})=>{const i=f.packets.findIndex((p,i)=>!used.has(i)&&p.url===String(url)&&p.method===(init.method??'GET')&&p.requestBody===(init.body??null));assert.ok(i>=0,'Missing exact receipt '+url);used.add(i);const p=f.packets[i],r=new Response(p.body,{status:p.status});Object.defineProperty(r,'url',{value:p.finalURL});return r}
 const stable=j=>{const c=structuredClone(j);delete c.scrapedAt;delete c.sourceOfficialBinding.checkedAt;return c}
 try{const jobs=await run({now:f.trial.completedAt});assert.equal(used.size,69);assert.equal(jobs.length,59);assert.deepEqual(projectNativeWorkdayClocks(jobs,f.trial.jobs,f.packets,stable),f.trial.jobs.map(stable));assert.equal(jobs.find(j=>j.jobId==='30213426').nativeLocationDiscrepancy.scopeAgreement,'India');assert.equal(jobs.find(j=>j.jobId==='30219751').city,null)}finally{globalThis.fetch=original}
})
for(const label of ['US - Chicago','United States - Remote','Singapore Office','Office Singapore','Chicago - US'])test('explicit foreign primary prefix or suffix contradicts typed India: '+label,async()=>{
 await assert.rejects(()=>replay(p=>{if(p.method==='POST'){const j=JSON.parse(p.body);for(const row of j.jobPostings)row.locationsText=label;p.body=JSON.stringify(j)}else detailChange(j=>{j.jobPostingInfo.location=label;j.jobPostingInfo.jobRequisitionLocation.descriptor=label;j.jobPostingInfo.additionalLocations=[]})(p)}),/country/)
})
test('explicit foreign structured-office prefix cannot hide behind an Indian primary',async()=>{await assert.rejects(()=>replay(detailChange(j=>{j.jobPostingInfo.jobRequisitionLocation.descriptor='Singapore Office'})),/country/)})
test('explicit foreign secondary prefix cannot hide behind an India suffix',async()=>{await assert.rejects(()=>replay(p=>{if(p.method==='POST'){const j=JSON.parse(p.body);for(const row of j.jobPostings)row.locationsText='2 Locations';p.body=JSON.stringify(j)}else detailChange(j=>{j.jobPostingInfo.additionalLocations=['Singapore Office, India']})(p)}),/country/)})
test('ambiguous Indian state code UK does not invent a foreign country',()=>{
 const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/new-secondary-20261021.json.gz',import.meta.url)))),p=JSON.parse(f.detail.body),label='UK - Dehradun',row={row:{...f.listing,locationsText:label},id:'30220599',url:p.jobPostingInfo.externalUrl};p.jobPostingInfo.location=label;p.jobPostingInfo.jobRequisitionLocation.descriptor=label;p.jobPostingInfo.additionalLocations=[];assert.equal(validateCarrierDetail(p,row,'2026-10-21T06:00:00Z').country,'India')
})
test('ordinary IT Park office words are not an Italy country prefix',()=>{
 const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/new-secondary-20261021.json.gz',import.meta.url)))),p=JSON.parse(f.detail.body),label='IT Park, Hyderabad, India',row={row:{...f.listing,locationsText:label},id:'30220599',url:p.jobPostingInfo.externalUrl};p.jobPostingInfo.location=label;p.jobPostingInfo.jobRequisitionLocation.descriptor=label;p.jobPostingInfo.additionalLocations=[];assert.equal(validateCarrierDetail(p,row,'2026-10-21T06:00:00Z').country,'India')
})

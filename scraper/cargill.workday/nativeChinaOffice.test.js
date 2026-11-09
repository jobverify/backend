import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {parseCargillOfficialRole,parseCargillRmkDetail} from './nativeContract.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/china-office-20261021.json.gz',import.meta.url))))
const {row,now}=fixture
const official=(html=fixture.public.body)=>parseCargillOfficialRole(html,row,{now})
const detail=(html=fixture.native.body,role=official(),url=fixture.native.finalURL)=>parseCargillRmkDetail(html,url,role,{now})
function publicChange(change){return fixture.public.body.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(all,open,raw,close)=>{const posting=JSON.parse(raw);if(posting['@type']!=='JobPosting')return all;change(posting);return open+JSON.stringify(posting)+close})}

// Missing CN mapping, a broad administrative suffix rule, or accepting a city
// mismatch must fail these real cross-surface contract cases.
test('actual public India and China offices plus full Shanghai native detail preserve only explicit India output',()=>{
 const role=official(),job=detail()
 assert.equal(role.requisitionId,'335763')
 assert.equal(role.applicationURL,'https://career2.successfactors.eu/sfcareer/jobreqcareer?jobId=335763&company=cargill&locale=en_US')
 assert.deepEqual(job.locations,['Bangalore, Karnataka, India'])
 assert.equal(job.country,'India');assert.equal(job.city,'Bangalore')
 assert.deepEqual(job.nativeLocations,['Shanghai, Shanghai, CN China, 200031'])
 assert.deepEqual(job.nativePublicLocations,role.addresses)
 assert.equal(job.nativePublicLocations[1].addressRegion,'Shanghai Municipality')
 assert.equal(job.sourceLocationCorroborationComplete,false)
 assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false)
 assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceDetailStatus,'complete')
 assert.equal(job.jobId,'335763');assert.equal(job.nativeRmkPublicId,'1375431857')
 assert.equal(job.jobDescription.length,2853)
 assert.equal(createHash('sha256').update(job.jobDescription).digest('hex'),'cebc207357d485d808edcf18fd8649cd055db2f88db484d5f1d399e17720e327')
 assert.equal(job.postedAt,'2026-10-21T00:00:00.000Z')
 assert.equal(job.nativeRmkPostedAt,'2026-10-21T00:00:00.000Z')
 assert.equal(job.closingDate,null)
})
test('China Shanghai administrative alias works in reverse and preserves raw native address',()=>{
 const role=official(publicChange(p=>p.jobLocation[1].address.addressRegion='Shanghai'))
 const job=detail(fixture.native.body.replace('Shanghai, Shanghai, CN China','Shanghai, Shanghai Municipality, CN China'),role)
 assert.deepEqual(job.nativeLocations,['Shanghai, Shanghai Municipality, CN China, 200031'])
 assert.deepEqual(job.locations,['Bangalore, Karnataka, India'])
})
for(const label of ['CN','Unknown','Chinese Mainland'])test('public unknown country label rejects '+label,()=>{
 assert.throws(()=>official(publicChange(p=>p.jobLocation[1].address.addressCountry=label)),/Unknown native public role country or office/)
})
test('public foreign-only role has no explicit India and rejects',()=>{
 assert.throws(()=>official(publicChange(p=>p.jobLocation=p.jobLocation.slice(1))),/no explicit native India office/)
})
for(const [name,change] of [
 ['unknown country code and name',s=>s.replace('CN China','XX Unknown')],
 ['conflicting country name',s=>s.replace('CN China','CN Unknown')],
 ['different city',s=>s.replace('Shanghai, Shanghai, CN China','Beijing, Shanghai, CN China')],
 ['different province',s=>s.replace('Shanghai, Shanghai, CN China','Shanghai, Jiangsu, CN China')],
 ['conflicting RMK country metadata',s=>s.replace('content="CN"','content="IN"')],
 ['wrong requisition',s=>s.replace('>335763', '>999999')],
 ['wrong canonical',s=>s.replace('rel="canonical" href="'+fixture.native.finalURL.replaceAll('&','&amp;'),'rel="canonical" href="https://jobs.cargill.com/job/Wrong/999999/')],
 ['future posting date',s=>s.replace('Wed Oct 21 00:00:00 UTC 2026','Wed Oct 21 00:00:00 UTC 2099')],
 ['invalid posting date',s=>s.replace('Wed Oct 21 00:00:00 UTC 2026','Wed Oct 99 00:00:00 UTC 2026')],
])test('Shanghai native cross-surface guard rejects '+name,()=>{
 const html=change(fixture.native.body);assert.notEqual(html,fixture.native.body,'mutation must affect captured response')
 assert.throws(()=>detail(html))
})
test('China administrative alias does not generalize to other region suffixes',()=>{
 const role=official(publicChange(p=>p.jobLocation[1].address.addressRegion='Shanghai Province'))
 assert.throws(()=>detail(fixture.native.body,role),/country\/city\/state mismatch/)
})
test('Shanghai Municipality alias remains China-only',()=>{
 const role=official(publicChange(p=>{p.jobLocation[1].address.addressCountry='India'}))
 const html=fixture.native.body.replace('CN China','IN India').replace('content="CN"','content="IN"')
 assert.throws(()=>detail(html,role),/country\/city\/state mismatch/)
})
test('public future date and wrong application requisition reject',()=>{
 assert.throws(()=>official(publicChange(p=>p.datePosted='2099-10-21')),/Invalid\/future native day/)
 assert.throws(()=>official(fixture.public.body.replaceAll('jobId=335763','jobId=999999')),/company\/requisition mismatch/)
})
for(const [name,value] of [['placeholder','<p>Apply now</p>'],['hidden','<div hidden>Build production software for trading engineering systems and improve performance.</div>'],['unavailable','<p>The full job description is currently unavailable. Please check back later for details about this position.</p>']])test('China mapping does not make '+name+' description complete',()=>{
 const html=fixture.native.body.replace(/(<span\b[^>]*itemprop="description"[^>]*>)[\s\S]*?(?=<\/span>)/,'$1'+value)
 const job=detail(html)
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailStatus,'native-full-description-missing')
})

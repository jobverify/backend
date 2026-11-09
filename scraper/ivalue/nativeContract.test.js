import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {validateIValueFeed,validateIValueDetail,resolveNativeLocations,validateCompany} from './nativeContract.js'
import {run,readIValueSourceDiagnostics,JOBS_API_URL,COMPANY_DETAILS_URL,EMPLOYMENT_CATEGORIES_URL,JOBS_PAGE_URL,OFFICIAL_CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261020.json',import.meta.url))),now='2026-10-20T23:20:00.000Z'
test('actual full feed has40unique records38explicitIndia and one unresolved shared public URL',()=>{const p=validateIValueFeed(f.listing,f.categories,{now});assert.equal(p.rows.length,40);assert.equal(p.rows.filter(r=>r.scope.indiaLocations.length).length,38);assert.equal(p.publicIdentityCollisions.length,1)})
test('actual detail matches native GUID/title/slug/full description and public status',()=>{const d=validateIValueDetail(f.detail,f.listing.data[0],f.categories,{now});assert.equal(d.sourceDetailComplete,true);assert.ok(d.description.length>1000)})
for(const [name,mutate]of[
 ['error envelope',p=>{p.success=false}],['missing data',p=>{delete p.data}],['duplicate GUID',p=>{p.data[1].id=p.data[0].id}],['duplicate native URL',p=>{p.data[1].apply_url=p.data[0].apply_url}],
 ['foreign apply origin',p=>{p.data[0].apply_url='https://other.greythr.com/hire/jobs/'+p.data[0].slug}],['array ID',p=>{p.data[0].id=[p.data[0].id]}],['unknown location ID',p=>{p.data[0].locations=['999999']}],
 ['future date',p=>{p.data[0].published_on_career_page='2099-01-01T00:00:00Z'}],['impossible calendar',p=>{p.data[0].published_on_career_page='2026-02-30T00:00:00Z'}],['false pagination',p=>{p.next='?page=2'}],
])test(`feed rejects ${name}`,()=>{const p=structuredClone(f.listing);mutate(p);assert.throws(()=>validateIValueFeed(p,f.categories,{now}))})
test('unknown category city is never defaulted to India',()=>{const c=structuredClone(f.categories);c.value['2'].name='Global Remote';assert.throws(()=>resolveNativeLocations(f.listing.data[0],c))})
for(const [name,mutate]of[
 ['unpublished',d=>{d.job_status='closed'}],['wrong title',d=>{d.job.title='Other role'}],['wrong UUID',d=>{d.job.id=f.listing.data[1].id}],['changed full description',d=>{d.job.description='<p>Other JD</p>'}],['location contradiction',d=>{d.job.locations=['972']}],['HTTP200 error',d=>{d.statusCode=500}],
])test(`detail rejects ${name}`,()=>{const d=structuredClone(f.detail);mutate(d);assert.throws(()=>validateIValueDetail(d,f.listing.data[0],f.categories,{now}))})
test('hidden or placeholder-only content is incomplete even if native listing and detail agree',()=>{for(const description of ['<p>NA</p>','<div hidden>Build systems</div>','<p>See attachment</p>']){const d=structuredClone(f.detail),r=structuredClone(f.listing.data[0]);d.job.description=r.description=description;assert.equal(validateIValueDetail(d,r,f.categories,{now}).sourceDetailComplete,false)}})
test('native company URL must exactly match official employer origin',()=>{const p=structuredClone(f.company);p.other_details.website='https://evil.test/?next=ivaluegroup.com';assert.throws(()=>validateCompany(p))})
const options=()=>({now:()=>now,fetchText:async url=>url===JOBS_PAGE_URL?f.board:f.corporateBlocked,fetchJson:async url=>url===COMPANY_DETAILS_URL?f.company:url===EMPLOYMENT_CATEGORIES_URL?f.categories:url===JOBS_API_URL?{data:[f.listing.data[0]]}:f.detail})
test('approved fresh binding plus current native identity can handle blocked corporate transport truthfully',async()=>{const jobs=await run(options());assert.equal(jobs.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs[0].sourceCorporateCheck,'blocked-interstitial-used-fresh-approved-binding')})
test('stale browser binding cannot replace a blocked current corporate check',async()=>await assert.rejects(run({...options(),now:()=> '2026-10-24T00:00:00Z'}),/binding|fresh/i))
test('explicit zero cap remains incomplete',async()=>{const jobs=await run({...options(),maxJobs:0});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
test('abort settles a hanging injected fetch',async()=>{const c=new AbortController(),p=run({...options(),signal:c.signal,fetchText:()=>new Promise(()=>{})});c.abort();await assert.rejects(p)})

test('actual duplicate public identity keeps only the exact resolved full detail and stays partial',async()=>{
 const detail=JSON.parse(fs.readFileSync(new URL('./fixtures/duplicate-detail-20261020.json',import.meta.url)))
 const rows=f.listing.data.filter(r=>r.slug==='manager-technology-sales'),base=options()
 const jobs=await run({...base,fetchJson:async(url,o)=>url===JOBS_API_URL?{data:rows}:url.includes('/get_job/')?detail:base.fetchJson(url,o)})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,detail.job.id);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].sourceListingComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const diagnostic=readIValueSourceDiagnostics(jobs)
 assert.equal(diagnostic.rawObservedIndiaRows,2);assert.equal(diagnostic.uniquePublicUrls,1);assert.equal(diagnostic.companyHealthComplete,false)
 assert.equal(diagnostic.rejectedNativeIdentities.length,1);assert.equal(diagnostic.rejectedNativeIdentities[0].reason,'ambiguous-public-url-resolves-to-another-native-identity')
})
test('current official navigation hook renews binding after stored browser proof expires',async()=>{
 const jobs=await run({...options(),now:()=> '2026-10-24T00:00:00Z',fetchOfficialPage:async()=>({status:200,url:OFFICIAL_CAREERS_URL,html:`<a href="${JOBS_PAGE_URL}">Explore opportunities</a>`})})
 assert.equal(jobs[0].sourceCorporateCheck,'active-current-official-handoff')
})
test('final full feed and category drift cannot certify a stable inventory',async()=>{
 for(const mode of ['feed','categories']){const base=options();let calls=0
  await assert.rejects(run({...base,fetchJson:async(url,o)=>{
   const value=structuredClone(await base.fetchJson(url,o))
   if(url===(mode==='feed'?JOBS_API_URL:EMPLOYMENT_CATEGORIES_URL)&&++calls===2){if(mode==='feed')value.data=[];else value.value['2'].name='Mumbai'}
   return value
  }}),/changed during details/)
 }
})
test('invalid capture time cannot certify an empty board through a current official handoff',async()=>{
 const base=options()
 await assert.rejects(run({...base,now:()=> 'not-a-date',fetchOfficialPage:async()=>({status:200,url:OFFICIAL_CAREERS_URL,html:`<a href="${JOBS_PAGE_URL}">Jobs</a>`}),fetchJson:async(u,o)=>u===JOBS_API_URL?{data:[]}:base.fetchJson(u,o)}),/check time/)
})

for(const empty of [false,true])test(`unknown additional hiring-event scope keeps collision-free${empty?' empty':' positive'} board incomplete`,async()=>{
 const base=options(),jobs=await run({...base,fetchJson:async(u,o)=>u===JOBS_API_URL?{data:empty?[]:[f.listing.data[0]]}:base.fetchJson(u,o)})
 assert.equal(jobs.length,empty?0:1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty');assert.equal(readIValueSourceDiagnostics(jobs).companyHealthComplete,false)
 assert.match(readInventoryEvidence(jobs).reason,/hiring-event.*unverified/)
 assert.ok(jobs.every(j=>j.sourceListingComplete===false))
})

for(const key of ['closing_date','expires_at','expiry_date'])test(`native detail reconciles exact ${key} with listing`,()=>{
 const listing=structuredClone(f.listing.data[0]),detail=structuredClone(f.detail)
 listing[key]='2026-01-01T00:00:00Z';detail.job[key]='2099-01-01T00:00:00Z'
 assert.throws(()=>validateIValueDetail(detail,listing,f.categories,{now}),/closing|expiry|expires/)
 detail.job[key]=listing[key];assert.equal(validateIValueDetail(detail,listing,f.categories,{now}).closingDate,listing[key])
 delete detail.job[key];assert.throws(()=>validateIValueDetail(detail,listing,f.categories,{now}),/closing|expiry|expires/)
 delete listing[key];detail.job[key]='2099-01-01T00:00:00Z';assert.throws(()=>validateIValueDetail(detail,listing,f.categories,{now}),/closing|expiry|expires/)
})

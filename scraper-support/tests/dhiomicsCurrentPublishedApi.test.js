import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'
import * as source from '../../scraper/dhiomics/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const payload = JSON.parse(await readFile(new URL('./fixtures/dhiomics-current/published-first-roles.json',import.meta.url),'utf8'))
const api = source.DARWINBOX_ORIGIN + '/ms/candidateapi/job/alljobs'
const officialPage = async url => ({status:200,url:url===source.OFFICIAL_HOMEPAGE_URL?source.VERIFIED_REDIRECT_URL:url,html:url===source.OFFICIAL_HOMEPAGE_URL?'<title>ADA Global | The Data &amp; AI Experience Company</title><h1>The Data &amp; AI Experience Company</h1><a href="https://adaglobal.com/careers/">Careers</a>':'<title>Careers | Build What the Next Era Runs On | ADA Global</title><h1>Build what the next era runs on</h1><p>Discover career opportunities at ADA Global</p><a href="https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/allJobs">Jobs</a>'})
const withPublicFetch = async (responseBody,callback,status=200) => {
 const original=globalThis.fetch
 const requests=[]
 globalThis.fetch=async(url,options={})=>{
  requests.push({url,options})
  if(url===source.PUBLIC_JOBS_URL)return new Response('<title>ADA</title>',{headers:{'set-cookie':'public-test-session=seed; Path=/'}})
  if(url===api+'?companyId=main')return new Response('<title>Attention Required! | Cloudflare</title>',{status:403})
  assert.equal(url,api)
  assert.equal(options.method,'POST')
  assert.deepEqual(JSON.parse(options.body),{companyId:'main',sort_option:'new',limit:10,page:1})
  assert.match(options.headers.cookie,/public-test-session=seed/)
  return new Response(JSON.stringify(responseBody),{status,headers:{'content-type':'application/json'}})
 }
 try {return await callback(requests)} finally {globalThis.fetch=original}
}
test('ADA source exposes the exact current published bare listing API URL',()=>{
 assert.equal(source.createDhiOmicsScraper().buildListingApiUrl(),api)
})
test('ADA published bare POST recovers roles while the obsolete query URL remains blocked',async()=>{
 await withPublicFetch(payload,async requests=>{
  const jobs=await source.run({fetchPage:officialPage})
  assert.equal(jobs.length,payload.data.filter(j=>j.country==='India').length)
  assert.ok(jobs.every(j=>j.location.includes('India')&&j.jobDescription.length>1000))
  assert.ok(requests.some(r=>r.url===api)&&!requests.some(r=>r.url.includes('?companyId=')))
 })
})
test('ADA published listing still fails closed on malformed or incomplete inventory',async()=>{
 await withPublicFetch({status:'success',data:[],job_counts:3},async()=>{
  await assert.rejects(source.run({fetchPage:officialPage}),/malformed or incomplete/)
 })
})
test('ADA published endpoint access denial remains an upstream failure, never an empty inventory',async()=>{
 await withPublicFetch({},async()=>{
  await assert.rejects(source.run({fetchPage:officialPage}),error=>error.failureKind==='blocked_or_access_denied'&&error.upstreamOutage===true)
 },403)
})

for (const [label,change] of [
 ['conflicting explicit country',row=>{row.country='Malaysia'}],
 ['unverified country',row=>{row.country=null}],
 ['conflicting location',row=>{row.locations='Kuala Lumpur, Malaysia'}],
]) test('ADA excludes '+label+' and preserves earlier inventory',async()=>{
 const changed=structuredClone(payload)
 change(changed.data.find(row=>row.country==='India'))
 await withPublicFetch(changed,async()=>{
  const jobs=await source.run({fetchPage:officialPage})
  assert.equal(jobs.length,1)
  assert.ok(jobs.every(job=>job.country==='India'&&job.sourceListingComplete===false))
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 })
})
test('ADA empty India result remains an unknown country inventory',async()=>{
 const changed=structuredClone(payload)
 changed.data.forEach(row=>{if(row.country==='India')row.country=null})
 await withPublicFetch(changed,async()=>{
  const jobs=await source.run({fetchPage:officialPage})
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 })
})
test('ADA truncated India description fails closed',async()=>{
 const changed=structuredClone(payload)
 changed.data.find(row=>row.country==='India').jd='<p>Developer</p>'
 await withPublicFetch(changed,async()=>assert.rejects(source.run({fetchPage:officialPage}),/description is incomplete/))
})
test('ADA caller cap remains incomplete and cannot authorize stale reconciliation',async()=>{
 await withPublicFetch(payload,async()=>{
  const jobs=await source.createDhiOmicsScraper({maxJobs:1}).run({fetchPage:officialPage})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceListingComplete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 })
})

test('ADA listing sends the current published client language header',async()=>{
 await withPublicFetch(payload,async requests=>{
  await source.run({fetchPage:officialPage})
  assert.equal(requests.find(request=>request.url===api).options.headers['Accept-Language'],'en')
 })
})

test('ADA caller cancellation happens before official HTTP requests',async()=>{
 const controller=new AbortController();controller.abort(new Error('stop-authority'))
 let calls=0
 await assert.rejects(source.run({signal:controller.signal,fetchPage:async()=>{calls++;return {}}}),/stop-authority/)
 assert.equal(calls,0)
})
test('ADA cancellation between official pages prevents the careers request',async()=>{
 const controller=new AbortController();let calls=0
 await assert.rejects(source.run({signal:controller.signal,fetchPage:async url=>{calls++;const page=await officialPage(url);controller.abort(new Error('stop-between'));return page}}),/stop-between/)
 assert.equal(calls,1)
})
test('ADA default official requests receive a bounded composed caller signal',async()=>{
 const original=globalThis.fetch;const controller=new AbortController();const signals=[]
 globalThis.fetch=async(url,options)=>{signals.push(options.signal);const page=await officialPage(url);const response=new Response(page.html);Object.defineProperty(response,'url',{value:page.url});return response}
 try{await source.run({signal:controller.signal,fetchListingPage:async()=>payload});assert.equal(signals.length,2);assert.ok(signals.every(s=>s&&s!==controller.signal&&!s.aborted))}finally{globalThis.fetch=original}
})
test('ADA rejects a duplicate raw ID across pages before a conflicting country can inherit eligibility',async()=>{
 const first=structuredClone(payload.data.find(r=>r.country==='India'));const conflicting={...first,country:'Malaysia',locations:'Kuala Lumpur, Malaysia'}
 await assert.rejects(source.run({fetchPage:officialPage,fetchListingPage:async({page})=>({status:'success',job_counts:11,data:page===1?[first]:[conflicting]})}),/duplicate.*ID/i)
})
test('ADA preserves native careers posting and closing dates as ISO values',async()=>{
 const body=structuredClone(payload);const active=body.data.find(r=>r.country==='India');active.job_posting.careers.to=Date.parse('2026-12-01T00:00:00Z')/1000
 const jobs=await source.createDhiOmicsScraper({now:()=> '2026-10-09T00:00:00Z'}).run({fetchPage:officialPage,fetchListingPage:async()=>body})
 const job=jobs.find(j=>j.jobId===active.id);assert.equal(job.postingDate,new Date(active.job_posting.careers.from*1000).toISOString());assert.equal(job.closingDate,'2026-12-01T00:00:00.000Z')
})
for(const[label,change]of[['ended',r=>{r.job_posting.careers.to=Date.parse('2026-10-01')/1000}],['future',r=>{r.posted_on=r.job_posting.careers.from=Date.parse('2026-11-01')/1000}]])test('ADA excludes '+label+' native careers lifecycle',async()=>{
 const body=structuredClone(payload);change(body.data.find(r=>r.country==='India'))
 const jobs=await source.createDhiOmicsScraper({now:()=> '2026-10-09T00:00:00Z'}).run({fetchPage:officialPage,fetchListingPage:async()=>body});assert.equal(jobs.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('ADA rejects contradictory native original publication fields',async()=>{
 const body=structuredClone(payload);body.data.find(r=>r.country==='India').job_posting.careers.from=Date.parse('2026-11-01')/1000
 await assert.rejects(source.createDhiOmicsScraper({now:()=> '2026-10-09T00:00:00Z'}).run({fetchPage:officialPage,fetchListingPage:async()=>body}),/publication epochs are malformed or inconsistent/)
})

test('ADA run-level caller cap remains incomplete',async()=>{
 const jobs=await source.run({maxJobs:1,fetchPage:officialPage,fetchListingPage:async()=>payload});assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false)
})

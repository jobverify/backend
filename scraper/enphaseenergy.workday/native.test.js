import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as adapter from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,buildScrapers} from '../../scraper-support/providers/index.js'
import {readNativeRoleAvailability,createNativeRoleAvailability} from '../../scraper-support/utils/sourceAvailability.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-002.json.gz',import.meta.url))))
const receipts=fixture.receipts,api=receipts.filter(r=>r.kind.startsWith('listing-page-')).sort((a,b)=>Number(a.kind.split('-').at(-1))-Number(b.kind.split('-').at(-1)))
const pages=api.map(r=>JSON.parse(r.storedBodyUTF8)),row=pages.flatMap(p=>p.rows).find(r=>r.jid==='o9tUAfwQ'),native=receipts.find(r=>r.kind==='india-detail-'+row.jid)
const at='2026-10-21T18:03:29.228Z'
const clone=x=>structuredClone(x)
function transport(transform=(r=>r)){
 const count=new Map(),calls=[]
 const fetchImpl=async(url,init)=>{
  calls.push({url,init});const matches=receipts.filter(r=>r.requestedURL===url);assert.ok(matches.length,'Fixture has exact configured URL '+url)
  const n=count.get(url)??0;count.set(url,n+1);const r=transform(clone(matches[Math.min(n,matches.length-1)]),n)
  return {status:r.status,ok:r.status===200,url:r.finalURL,headers:{get:()=>r.contentType},text:async()=>r.storedBodyUTF8}
 }
 return{fetchImpl,calls}
}
const detailFor=(r,jd,extra='')=>`<div class="rich-text"><div class="jobvite-detail__intro"><h1>${r.name}</h1><h5>${r.location}</h5><div class="jobvite-detail__requisition-id">Requisition ID: ${r.requisitionid}</div></div><div class="jobvite-detail__content">${jd}</div><a href="${r.applyUrl}">Apply now</a>${extra}</div>`
const substantive='<h2>Responsibilities</h2><p>'+('Design and implement reliable enterprise software, review code and collaborate with engineers. ').repeat(8)+'</p><h2>Requirements</h2><p>Experience in Java and Angular, a relevant engineering degree and strong testing skills.</p>'

test('source046 replaces exactly one sentinel with unknown verification counts',()=>{
 const all=getScraperCatalog(),p=all.find(p=>p.source==='enphaseenergy')
 assert.equal(all.filter(row=>row.source==='enphaseenergy').length,1);assert.equal(p.companyName,'Enphase Energy');assert.equal(p.companyDomain,'enphase.com')
 assert.equal(p.atsPlatform,'enphase-native-corporate-api');assert.equal(p.jobsBoardUrl,'https://enphase.com/api/v2/jobs')
 assert.match(p.modulePath,/enphaseenergy.workday[\\/]script.js$/)
 for(const key of ['verifiedOn','verifiedAt','verifiedPublicJobCount','verifiedIndiaJobCount'])assert.equal(p[key],null)
 assert.equal(p.sourceScopeComplete,false)
 assert.ok(buildScrapers().some(s=>s.name==='enphaseenergy'))
})
test('current sealed native replay exhausts 70 records and rechecks 23 India full roles without renewing capture dates',async()=>{
 const t=transport(),jobs=await adapter.run({...t,now:at})
 assert.equal(jobs.length,23)
 assert.ok(jobs.every(j=>j.country==='India'&&j.jobDescription.length>300&&j.sourceDetailComplete))
 assert.ok(jobs.every(j=>j.sourceObservedNativeRecords===70&&j.sourceObservedNativeIndiaRecords===23))
 assert.ok(jobs.every(j=>j.postingDate===null&&j.postedAt===null&&j.closingDate===null&&j.nativeDateUnknown===true&&j.nativeLegalEmployer===null&&j.nativePostingStatus===null))
 assert.ok(jobs.every(j=>j.sourceListingComplete===false&&j.sourceScopeComplete===false&&j.sourceGlobalJobCount===null&&j.sourceIndiaJobCount===null))
 assert.ok(jobs.every(j=>j.scrapedAt===at&&j.applicationAccessValidated===false&&j.applicationEligibilityQualified===false))
 assert.equal(jobs[0].applyUrl,row.applyUrl.replaceAll('&amp;','&'))
 assert.equal(jobs[0].sourceUrl,'https://enphase.com/job/'+row.jid)
 const e=readInventoryEvidence(jobs);assert.equal(e.listingComplete,false);assert.equal(e.status,'coverage-gap');assert.equal(e.reportedTotal,null)
 assert.equal(t.calls.filter(c=>c.url.includes('/api/v2/jobs')).length,20)
 assert.equal(t.calls.filter(c=>c.url.includes('/job/')).length,46)
 assert.ok(t.calls.every(c=>c.init.method==='GET'))
 assert.ok(t.calls.filter(c=>c.url.includes('/api/v2/jobs')).every(c=>c.init.headers.Accept==='application/json'))
 assert.ok(t.calls.filter(c=>c.url.includes('/job/')||c.url.endsWith('/careers')).every(c=>c.init.headers.Accept==='text/html,application/xhtml+xml'))
 assert.equal(t.calls.some(c=>c.url.includes('jobvite.com')),false)
})
test('finite pager validates every page size, page index, last page and declared total',()=>{
 assert.equal(typeof adapter.parsePage,'function')
 for(let i=0;i<pages.length;i++)assert.equal(adapter.parsePage(JSON.stringify(pages[i]),i).rows.length,7)
 const small=clone(pages[0]);small.pager={current_page:0,total_items:'1',total_pages:1,items_per_page:7};small.rows=[clone(row)]
 assert.equal(adapter.parsePage(JSON.stringify(small),0).rows.length,1)
 for(const mutate of [p=>p.pager.current_page++,p=>p.pager.total_pages=Infinity,p=>p.pager.items_per_page=0,p=>p.rows.pop(),p=>p.pager.total_items='-1',p=>p.pager.total_pages=500]){const p=clone(pages[0]);mutate(p);assert.throws(()=>adapter.parsePage(JSON.stringify(p),0))}
})
test('binding checks current active client and exact native roles; hidden or guessed client cannot qualify',()=>{
 assert.equal(typeof adapter.parseBinding,'function')
 const h=receipts[0].storedBodyUTF8,js=receipts[1].storedBodyUTF8
 assert.equal(adapter.parseBinding(h,js),receipts[1].requestedURL)
 assert.throws(()=>adapter.parseBinding(h.replaceAll('career-search-form.js','other.js'),js))
 assert.throws(()=>adapter.parseBinding(h,js.replaceAll('"page",t','"offset",t')))
 assert.throws(()=>adapter.parseBinding(`<template>${h}</template>`,js))
 assert.throws(()=>adapter.parseBinding(h.replaceAll('Careers at Enphase | Clean Energy Jobs','Unrelated company'),js))
 assert.throws(()=>adapter.parseBinding(h.replace('rel="canonical" href="https://enphase.com/careers"','rel="canonical" href="https://example.com/careers"'),js))
})
test('native full JD accepts empty first layout and preserves raw native row',()=>{
 assert.equal(typeof adapter.parseDetail,'function')
 const job=adapter.parseDetail(native.storedBodyUTF8,row,{now:at})
 assert.equal(job.title,'Senior Full Stack Developer');assert.equal(job.sourceDetailComplete,true)
 assert.equal(job.nativeDescriptionOriginal,row.description__value);assert.equal(job.nativeLocationOriginal,row.location)
 assert.match(job.jobDescription,/Proven ability to work independently/)
})
test('active native role header closure nulls full JD while retaining raw native evidence and unknown dates',()=>{
 for(const notice of ['This position is closed.','This job is no longer available.','No longer accepting applications.']){
  const html=native.storedBodyUTF8.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro"><p>'+notice+'</p>')
  assert.notEqual(html,native.storedBodyUTF8)
  const job=adapter.parseDetail(html,row,{now:at})
  assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailStatus,'native-role-closed')
  assert.equal(job.sourceAvailabilityEvidence?.state,'closed')
  assert.equal(job.jobDescription,null);assert.equal(job.sourceDescription,null)
  assert.equal(job.nativeDescriptionOriginal,row.description__value);assert.ok(job.nativeCorporateDescriptionText.length>6000)
  assert.equal(job.nativeRejectedDetailHTML,html);assert.equal(job.nativeListingOriginal.jid,row.jid)
  assert.equal(job.nativePostingStatus,null);assert.equal(job.nativeDateUnknown,true)
  assert.equal(job.postingDate,null);assert.equal(job.postedAt,null);assert.equal(job.closingDate,null)
 }
})
test('inactive closure text inside the native header and unrelated active footer do not close an advertised role',()=>{
 for(const notice of ['<p hidden>This position is closed.</p>','<p inert>This position is closed.</p>','<template><p>This position is closed.</p></template>','<script>This position is closed.</script>']){
  const html=native.storedBodyUTF8.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro">'+notice)+'<footer>This position is closed.</footer>'
  const job=adapter.parseDetail(html,row,{now:at})
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceDetailStatus,'complete');assert.ok(job.jobDescription.length>6000)
  const availability=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now:at})
  if(notice==='<p inert>This position is closed.</p>'){
   // Inert affects interaction, not visual absence: retain JD facts and withhold availability.
   assert.deepEqual(job.sourceAvailabilityEvidence,{state:'unavailable',reason:'native-status-layout-unqualified'})
   assert.equal(availability.state,'unavailable');assert.equal(availability.validated,false);assert.equal(metrics.eligibleJobs.length,0)
  }else{assert.equal(availability.validated,true);assert.equal(availability.state,'open');assert.equal(metrics.eligibleJobs.length,1)}
  assert.equal(metrics.filterCounts.closed,0)
 }
})
test('stable active header closure remains unpublishable through full source reconciliation',async()=>{
 const t=transport(r=>{
  if(r.requestedURL==='https://enphase.com/job/'+row.jid)r.storedBodyUTF8=r.storedBodyUTF8.replace('<h1','<p class="jobvite-detail__status">This position is closed.</p><h1')
  return r
 })
 const jobs=await adapter.run({...t,now:at}),closed=jobs.find(j=>j.jobId===row.jid)
 assert.equal(closed.jobDescription,null);assert.equal(closed.sourceDetailStatus,'native-role-closed')
 assert.equal(closed.nativeDescriptionOriginal,row.description__value);assert.equal(closed.postedAt,null)
 assert.match(closed.nativeRejectedDetailHTML,/This position is closed/)
 const {analyzePublishableJobs}=await import('../../scraper-support/utils/publishableJobMetrics.js')
 const quality=analyzePublishableJobs(jobs,{now:new Date(at)})
 assert.equal(quality.eligibleJobs.includes(closed),false);assert.equal(quality.filterCounts.closed,1)
 assert.equal(quality.filterCounts.emptyDescription,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('new role-header closure during final reconciliation fails instead of publishing earlier content',async()=>{
 const t=transport((r,n)=>{
  if(n>0&&r.requestedURL==='https://enphase.com/job/'+row.jid)r.storedBodyUTF8=r.storedBodyUTF8.replace('<h1','<p>This position is closed.</p><h1')
  return r
 })
 await assert.rejects(adapter.run({...t,now:at}),/Authoritative native detail fields changed/)
})
test('full JD guards retain raw rejection evidence with null publishable content',()=>{
 assert.equal(typeof adapter.parseDetail,'function')
 for(const jd of ['', '<p>Apply now</p>', '<p>The full job description is unavailable. Please click Apply now.</p>'.repeat(8), '<p>This position is closed.</p>'+substantive]){
  const r={...row,description__value:jd},job=adapter.parseDetail(detailFor(r,jd),r,{now:at})
  assert.equal(job.jobDescription,null);assert.equal(job.sourceDescription,null);assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.nativeDescriptionOriginal,jd);assert.ok(job.sourceDetailStatus)
 }
 const r={...row,description__value:substantive}
 const marketing='<p>'+('Enphase Energy is a global energy technology company. Join our dynamic teams. ').repeat(10)+'</p>'
 assert.equal(adapter.parseDetail(detailFor({...r,description__value:marketing},marketing),{...r,description__value:marketing},{now:at}).jobDescription,null)
 const conflicting=detailFor(r,substantive,`<div class="jobvite-detail__content">${substantive}Contradictory full content.</div>`)
 assert.equal(adapter.parseDetail(conflicting,r,{now:at}).jobDescription,null)
 assert.equal(adapter.parseDetail(detailFor(r,substantive).replace('class="rich-text"','class="marketing"'),r,{now:at}).jobDescription,null)
 assert.equal(adapter.parseDetail(detailFor(r,substantive).replace('class="jobvite-detail__content"','class="jobvite-detail__content" inert'),r,{now:at}).jobDescription,null)
 for(const absent of [undefined,null]){
  const missing={...row,description__value:absent},job=adapter.parseDetail(detailFor(missing,''),missing,{now:at})
  assert.equal(job.jobDescription,null);assert.equal(job.nativeDescriptionOriginal,null)
 }
})
test('role scoped guards allow valid JD with unrelated footer and empty inactive wrapper',()=>{
 assert.equal(typeof adapter.parseDetail,'function')
 const r={...row,description__value:substantive}
 const html='<div class="jobvite-detail__content"></div>'+detailFor(r,substantive)+'<footer>This job is no longer available</footer><template><div class="jobvite-detail__content">Closed</div></template>'
 assert.ok(adapter.parseDetail(html,r,{now:at}).jobDescription)
})
test('wrong native account, role ID, geography, title and requisition cannot pass detail identity',()=>{
 assert.equal(typeof adapter.parseDetail,'function')
 for(const r of [{...row,applyUrl:row.applyUrl.replace('qu49Vfwm','wrong')},{...row,applyUrl:row.applyUrl.replace(row.jid,'other')},{...row,location:'Bangalore, India, United States'},{...row,location:'Bangalore, United States'},{...row,name:'Different role'},{...row,requisitionid:'0000'}])assert.throws(()=>adapter.parseDetail(native.storedBodyUTF8,r,{now:at}))
 const r={...row,description__value:substantive}
 assert.throws(()=>adapter.parseDetail(detailFor(r,substantive).replace('k=Apply','k=Other'),r,{now:at}))
 const variant={...row,jid:row.jid+'-CEmWWfwC'}
 assert.throws(()=>adapter.parseDetail(detailFor(variant,substantive),variant,{now:at}))
})
test('new authoritative native date contracts require review instead of discarding supplied dates',()=>{
 const r={...row,description__value:substantive}
 for(const head of ['<meta name="datePosted" content="2020-01-01">','<time datetime="2020-01-01">Posted January 2020</time>','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2020-01-01"}</script>'])assert.throws(()=>adapter.parseDetail(head+detailFor(r,substantive),r,{now:at}),/date.*contract|structured.*contract/i)
 assert.throws(()=>adapter.parseDetail(detailFor(r,substantive),{...r,datePosted:'2020-01-01'},{now:at}),/field contract/)
})
test('partial enumeration, duplicate IDs, pager drift and failure throw without a fabricated zero',async()=>{
 for(const kind of ['upstream','duplicate','pager','detail','recheck','country']){
  const t=transport((r,n)=>{
   if(kind==='upstream'&&r.kind==='listing-page-2')r.status=503
   if(['duplicate','pager','country'].includes(kind)&&r.kind==='listing-page-2'){const p=JSON.parse(r.storedBodyUTF8);if(kind==='duplicate')p.rows[0]=clone(pages[0].rows[0]);if(kind==='pager')p.pager.total_items='69';if(kind==='country')p.rows[0].location='Bangalore, India, United States';r.storedBodyUTF8=JSON.stringify(p)}
   if(kind==='detail'&&r.kind.startsWith('india-detail-'))r.status=404
   if(kind==='recheck'&&n>0&&r.requestedURL.includes('/api/v2/jobs')){const p=JSON.parse(r.storedBodyUTF8);p.rows[0].name+=' changed';r.storedBodyUTF8=JSON.stringify(p)}
   return r
  })
  const expected={upstream:/503/,duplicate:/Duplicate native IDs/,pager:/Pager drift/,detail:/404/,recheck:/listing fields or pager changed/,country:/conflicting explicit India/}
  await assert.rejects(adapter.run({...t,now:at}),expected[kind],kind)
 }
})
test('native detail field drift in final recheck fails closed',async()=>{
 const t=transport((r,n)=>{if(n>0&&r.requestedURL.includes('/job/'))r.storedBodyUTF8=r.storedBodyUTF8.replace('Requisition ID:','Requisition changed:');return r})
 await assert.rejects(adapter.run({...t,now:at}),/title\/location\/requisition mismatch/)
})
test('runtime retains a missing native JD as eligible with incomplete detail health',async()=>{
 const t=transport(r=>{
  if(r.requestedURL.includes('/api/v2/jobs')){const p=JSON.parse(r.storedBodyUTF8);const target=p.rows.find(x=>x.jid===row.jid);if(target)target.description__value='';r.storedBodyUTF8=JSON.stringify(p)}
  if(r.requestedURL==='https://enphase.com/job/'+row.jid)r.storedBodyUTF8=detailFor({...row,description__value:''},'')
  return r
 })
 const jobs=await adapter.run({...t,now:at}),rejected=jobs.find(j=>j.jobId===row.jid)
 assert.equal(jobs.length,23);assert.equal(rejected.jobDescription,null);assert.equal(rejected.nativeDescriptionOriginal,'');assert.ok(rejected.nativeRejectedDetailHTML)
 const {analyzePublishableJobs}=await import('../../scraper-support/utils/publishableJobMetrics.js')
 const quality=analyzePublishableJobs(jobs,{now:new Date(at)})
 assert.equal(quality.filterCounts.emptyDescription,0);assert.equal(quality.eligibleJobs.includes(rejected),true)
 assert.equal(rejected.sourceDetailComplete,false);assert.equal(rejected.sourceDetailStatus,'missing-unscoped-or-conflicting-native-description')
 assert.ok(quality.eligibleJobs.every(j=>j.nativeDateUnknown&&j.postedAt===null))
})
test('source deadline and explicit truncation cannot return partial candidates',async()=>{
 await assert.rejects(adapter.run({maxJobs:1,now:at}))
 await assert.rejects(adapter.run({now:at,timeoutMs:10,fetchImpl:async()=>new Promise(()=>{})}))
})
test('default transport sends appropriate Accept through actual fetch path',async()=>{
 const original=globalThis.fetch,t=transport();globalThis.fetch=t.fetchImpl
 try{const jobs=await adapter.run({now:at});assert.equal(jobs.length,23);assert.ok(t.calls.some(c=>c.url.endsWith('.js?v=1.x')&&c.init.headers.Accept==='application/javascript'))}finally{globalThis.fetch=original}
})

const attributeAvailabilityCases=[['hidden restored block','hidden style="display:block"'],['bare inert','inert'],['aria hidden','aria-hidden="true"']]
for(const[name,attributes]of attributeAvailabilityCases)test('status attribute uncertainty preserves raw facts and blocks publication: '+name,()=>{
 const html=native.storedBodyUTF8.replace('<div class="jobvite-detail__intro">','<div class="jobvite-detail__intro"><p '+attributes+'>This role is closed.</p>'),now=native.completedAt,healthy=adapter.parseDetail(native.storedBodyUTF8,row,{now}),job=adapter.parseDetail(html,row,{now})
 assert.deepEqual(job.sourceAvailabilityEvidence,{state:'unavailable',reason:'native-status-layout-unqualified'})
 assert.equal(job.jobDescription,healthy.jobDescription);assert.equal(job.sourceDescription,healthy.sourceDescription);assert.equal(job.nativeDescriptionOriginal,row.description__value)
 assert.deepEqual(job.nativeListingOriginal,healthy.nativeListingOriginal);assert.equal(job.sourceDetailComplete,true);assert.equal(job.scrapedAt,native.completedAt)
 const proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now});assert.equal(proof.validated,false);assert.equal(proof.state,'unavailable');assert.equal(metrics.eligibleJobs.length,0);assert.equal(metrics.filterCounts.closed,0);assert.equal(metrics.filterCounts.unavailable,1)
 for(const state of['open','closed'])assert.throws(()=>createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:html}),error=>error.code==='NATIVE_STATUS_LAYOUT_UNQUALIFIED')
 assert.equal(job.postedAt,null);assert.equal(job.closingDate,null);assert.equal(job.nativeLegalEmployer,null);assert.equal(job.sourceScopeComplete,false)
})
test('status attribute confidence retains healthy validated OPEN and native clocks',()=>{
 const now=native.completedAt,job=adapter.parseDetail(native.storedBodyUTF8,row,{now}),proof=readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now})
 assert.equal(proof.validated,true);assert.equal(proof.state,'open');assert.equal(proof.observedAt,native.completedAt);assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0);assert.equal(job.nativeDescriptionOriginal,row.description__value)
})

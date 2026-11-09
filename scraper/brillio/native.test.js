import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractJobDetail,extractListingJobs} from './script.js'
import {resolveWorksiteCountry} from './worksiteCountry.js'

const corporate='<a href="/careers/">Careers</a>'
const careers='<a href="https://careers.brillio.com/job-listing/">Explore</a>'
const board=`<form id="job-filter-form"></form><script>
var ajaxurl="https://careers.brillio.com/wp-admin/admin-ajax.php";
function loadJobs(page=1){$.ajax({url:ajaxurl,type:"POST",data:{action:"filter_jobs",job_title:$("#job_title").val(),country:$("#country").val(),jobpost:$("#jobpost").val(),hybrid:$("#hybrid").is(":checked")?1:0,onsite:$("#onsite").is(":checked")?1:0,remote:$("#remote").is(":checked")?1:0,paged:page},success:function(response){$("#job-results").html(response.data.html);$(".ajax-pagination").html(response.data.pagination)}})}</script>`
const card=(id,location='Bangalore, India')=>`<div class="job-listing__item"><h4 class="title"><strong>Engineer - R${id}</strong></h4><p class="location">${location}</p><span class="info-pills">LTR</span><p class="description">Preview ...<a class="see-more" href="https://careers.brillio.com/job-details?job-id=${id}">See more</a></p><a class="btn btn-cta" href="https://careers.brillio.com/job-details?job-id=${id}">Apply</a></div>`
const detail=(id,extra='',location='Bangalore, India',apply=id)=>`<meta property="article:published_time" content="2022-03-22T04:29:21+00:00"><section class="job-detail"><div class="job-detail__item"><h1 class="title">Engineer - R${id}</h1><p class="location">${location}</p><span class="info-pills">LTR</span><div class="description-block"><div class="description"><h6>Primary Skills</h6><ul><li>SQL, Python</li></ul><h6>Job requirements</h6><ul><li>Build reliable pipelines and test all source to target transformations.</li></ul>${extra}</div></div>${apply?`<a href="https://careers.brillio.com/privacy-notice?job-id=${apply}" class="btn btn-cta">Apply</a>`:''}</div></section>`
const pagination=page=>`<ul class="page-numbers"><li><${page===1?'span aria-current="page"':'a href="/wp-admin/admin-ajax.php?paged=1"'}>1</${page===1?'span':'a'}></li><li><${page===2?'span aria-current="page"':'a href="/wp-admin/admin-ajax.php?paged=2"'}>2</${page===2?'span':'a'}></li></ul>`
const registered=()=>createCatalogScraper(getScraperCatalog().find(x=>x.source==='brillio'))
const fixture=(overrides={})=>{
 const requests=[]
 const fetch=async(url,init={})=>{
  requests.push({url:String(url),method:init.method||'GET',body:init.body})
  let body=String(url)==='https://www.brillio.com/'?corporate:String(url)==='https://www.brillio.com/careers/'?careers:String(url)==='https://careers.brillio.com/job-listing/'?board:null
  if(init.method==='POST') {const page=Number(new URLSearchParams(init.body).get('paged'));body=JSON.stringify({success:true,data:{html:page===1?card('1')+card('2','Dallas, United States'):card('3','Boston'),pagination:pagination(page)}})}
  const id=new URL(url).searchParams.get('job-id');if(id)body=detail(id,'',id==='3'?'Boston':'Bangalore, India')
  const override=overrides[String(url)];if(override!==undefined)body=typeof override==='function'?override(init):override
  assert.notEqual(body,null,'unexpected fixture request '+url)
  const response=new Response(body,{status:overrides.status||200})
  if(overrides.finalUrls?.[String(url)])Object.defineProperty(response,'url',{value:overrides.finalUrls[String(url)]})
  return response
 };return{fetch,requests}
}
test('current native cards preserve posting ID separately from requisition and infer no work mode from LTR',()=>{
 const rows=extractListingJobs(card('21232'))
 assert.equal(rows.length,1);assert.equal(rows[0].jobId,'21232');assert.equal(rows[0].requisitionId,'R21232')
 const d=extractJobDetail(detail('21232'),{jobId:'21232'})
 assert.match(d.jobDescription,/Build reliable pipelines/);assert.equal(d.postingDate,null);assert.equal(d.remoteStatus,null)
})
test('detail includes visible criteria outside description delimiters and excludes inert and zero opacity content once',()=>{
 const html=detail('1',`<template>Template bad criteria</template><div inert>Inert bad criteria</div><object>Object fallback bad criteria</object><iframe>Frame fallback bad criteria</iframe><noscript>Noscript bad criteria</noscript><script>Script bad criteria</script><style>.zero { opacity: 0e0 } .entity { opacity: &amp;#48; }</style><p class="zero">Stylesheet bad criteria</p><p style="opacity:00">Zero bad criteria</p><p style="opacity:+0">Plus bad criteria</p><p style="opacity:0e0">Exponent bad criteria</p><p style="opacity:&#48;">Entity bad criteria</p><p style="opacity:&amp;#48;">Uncertain visible criteria</p><p class="entity">Raw CSS visible criteria</p><p>Certification &amp;#65; is required</p>`).replace('</div></section>','<aside>Outside certification is mandatory.</aside></div></section>')
 const d=extractJobDetail(html,{jobId:'1'})
 assert.match(d.jobDescription,/Outside certification is mandatory/)
 assert.doesNotMatch(d.jobDescription,/bad criteria/)
 assert.match(d.jobDescription,/Certification &#65; is required/)
 assert.match(d.jobDescription,/Uncertain visible criteria/);assert.match(d.jobDescription,/Raw CSS visible criteria/)
 assert.equal(d.sourceDetailComplete,false)
})
test('missing or mismatched native application identity never constructs an apply URL',()=>{
 for(const apply of [null,'99']){const d=extractJobDetail(detail('1','',undefined,apply),{jobId:'1'});assert.equal(d.applyUrl,null);assert.equal(d.sourceDetailComplete,false)}
})
test('a heading embedded in the native description remains visible criteria and cannot replace the role title',()=>{
 const d=extractJobDetail(detail('1','<h1>Mandatory architecture certification</h1>'),{jobId:'1'})
 assert.equal(d.title,'Engineer - R1');assert.match(d.jobDescription,/Mandatory architecture certification/);assert.equal(d.sourceDetailComplete,true)
})
test('visible criteria beside the main role item are retained and prevent a truncated full claim',()=>{
 const d=extractJobDetail(detail('1').replace('</section>','<aside>Security clearance is mandatory.</aside></section>'),{jobId:'1'})
 assert.match(d.jobDescription,/Security clearance is mandatory/)
 assert.equal(d.sourceDetailComplete,false)
})
test('the role-owned apply control outside the item is navigation and does not become omitted criteria',()=>{
 const html=detail('1').replace('<a href="https://careers.brillio.com/privacy-notice?job-id=1" class="btn btn-cta">Apply</a></div>','</div><a href="https://careers.brillio.com/privacy-notice?job-id=1" class="btn btn-cta">Apply</a>')
 const d=extractJobDetail(html,{jobId:'1'});assert.equal(d.sourceDetailComplete,true);assert.doesNotMatch(d.jobDescription,/Apply/)
})
test('unresolved JobPosting criteria remain structured evidence and cannot be silently called full',()=>{
 const d=extractJobDetail(detail('1')+'<script type="application/ld+json">{"@type":"JobPosting","identifier":"99","qualifications":"Professional certification required"}</script>',{jobId:'1'})
 assert.equal(d.sourceDetailComplete,false);assert.equal(d.sourceNativeStructuredCriteria[0].qualifications,'Professional certification required')
})
test('canvas fallback does not become visible native criteria',()=>{
 const d=extractJobDetail(detail('1','<canvas>Fallback certification does not render</canvas>'),{jobId:'1'})
 assert.doesNotMatch(d.jobDescription,/Fallback certification/);assert.equal(d.sourceDetailComplete,false)
})
test('registered path enumerates unfiltered pages and unknown country details before caps and retains partial evidence',async()=>{
 const f=fixture(),jobs=await registered().run({...f,maxJobs:1,now:'2026-10-27T05:00:00Z'})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'1');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].employmentType,null);assert.equal(jobs[0].remoteStatus,null)
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(f.requests.some(r=>r.url.endsWith('job-id=3')));assert.ok(!f.requests.some(r=>r.url.endsWith('job-id=2')))
 assert.equal(f.requests.filter(r=>r.method==='POST').length,4)
 for(const r of f.requests.filter(r=>r.method==='POST')){const q=new URLSearchParams(r.body);assert.equal(q.get('country'),'');assert.equal(q.get('jobpost'),'all');assert.equal(q.get('remote'),'0')}
 assert.equal(jobs[0].sourceNativeInventory.globalCount,3);assert.equal(jobs[0].sourceNativeInventory.countryUnknownCount,1)
})
test('careers denial stops immediately without retry or subsequent discovery',async()=>{
 const f=fixture({status:403}),jobs=await registered().run(f)
 assert.equal(jobs.length,0);assert.equal(f.requests.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('the current corporate homepage can bind directly to the exact native job board',async()=>{
 const f=fixture({'https://www.brillio.com/':'<main><a href="https://careers.brillio.com/job-listing/">Explore Careers</a></main>'})
 const jobs=await registered().run(f)
 assert.equal(jobs.length,1)
 assert.equal(readInventoryEvidence(jobs).firstParty,true)
 assert.equal(f.requests.some(r=>r.url==='https://www.brillio.com/careers/'),false)
 assert.equal(f.requests.filter(r=>r.method==='POST').length,4)
 assert.equal(jobs[0].sourceListingComplete,false,'unresolved role geography must still remain partial')
})
test('the advertised native board root must redirect to the exact verified listing page',async()=>{
 for(const href of ['https://careers.brillio.com','https://careers.brillio.com/']){
  const f=fixture({
   'https://www.brillio.com/':`<main><a href="${href}">Explore Careers</a></main>`,
   'https://careers.brillio.com/':board,
   finalUrls:{'https://careers.brillio.com/':'https://careers.brillio.com/job-listing/'},
  })
  const jobs=await registered().run(f)
  assert.equal(jobs.length,1)
  assert.equal(readInventoryEvidence(jobs).firstParty,true)
  assert.equal(f.requests.some(r=>r.url==='https://www.brillio.com/careers/'),false)
  assert.equal(f.requests.filter(r=>r.method==='POST').length,4)
 }
})
test('a native board root redirect to another route cannot authorize search requests',async()=>{
 const f=fixture({
  'https://www.brillio.com/':'<a href="https://careers.brillio.com/">Careers</a>',
  'https://careers.brillio.com/':board,
  finalUrls:{'https://careers.brillio.com/':'https://careers.brillio.com/other-board/'},
 })
 const jobs=await registered().run(f)
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).firstParty,false)
 assert.equal(f.requests.filter(r=>r.method==='POST').length,0)
 assert.match(readInventoryEvidence(jobs).reason,/redirect mismatch/)
})
test('the current native careers landing page binds its slashless listing link before fetching jobs',async()=>{
 const f=fixture({
  'https://www.brillio.com/':'<a href="http://[">Unrelated malformed link</a><a href="https://careers.brillio.com">Explore Careers</a>',
  'https://careers.brillio.com/':'<h1>Brillio Careers</h1><a href="https://careers.brillio.com/job-listing">Explore all jobs</a>',
 })
 const jobs=await registered().run(f)
 assert.equal(jobs.length,1)
 assert.equal(readInventoryEvidence(jobs).firstParty,true)
 assert.equal(f.requests.some(r=>r.url==='https://careers.brillio.com/job-listing/'),true)
 assert.equal(f.requests.some(r=>r.url==='https://www.brillio.com/careers/'),false)
})
test('hidden, inert, and foreign direct board links cannot establish the employer handoff',async()=>{
 for(const html of [
  '<template><a href="https://careers.brillio.com/job-listing/">Careers</a></template>',
  '<a hidden href="https://careers.brillio.com/job-listing/">Careers</a>',
  '<a href="https://careers.brillio.com.evil.invalid/job-listing/">Careers</a>',
  '<a href="https://careers.brillio.com/job-listing/?employer=other">Careers</a>',
 ]){
  const f=fixture({'https://www.brillio.com/':html}),jobs=await registered().run(f)
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).firstParty,false)
  assert.equal(f.requests.length,1)
 }
})
test('a failed employer handoff retains the actual diagnostic on the empty result',async()=>{
 const f=fixture({'https://www.brillio.com/':'<main>Website changed</main>'}),jobs=await registered().run(f)
 assert.equal(jobs.length,0)
 assert.match(readInventoryEvidence(jobs).reason,/corporate careers handoff missing/)
})
test('detail failure keeps an explicitly partial preview with no fabricated application identity',async()=>{
 const f=fixture({'https://careers.brillio.com/job-details?job-id=1':()=>{throw Error('network failure')}}),jobs=await registered().run(f)
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].applyUrl,null);assert.equal(jobs[0].sourceListingComplete,false)
 assert.equal(jobs[0].sourceDescriptionType,'listing-preview');assert.match(jobs[0].jobDescription,/Preview/)
})
test('an explicit native closing notice withholds the closed role without inventing an expiry date',async()=>{
 const f=fixture({'https://careers.brillio.com/job-details?job-id=1':detail('1','<p>This position is closed.</p>')})
 const jobs=await registered().run(f)
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('all role-owned US worksite alternatives resolve country and allow finite observed inventory completeness without a Total',async()=>{
 const context='Location: Hybrid 3 days for these locations Madison, NJ/Manhattan, | Greater Boston Area |South Florida Area | Greater Seattle Area , WA As a consultant within the DE team, you will deliver software.'
 const f=fixture({'https://careers.brillio.com/job-details?job-id=3':detail('3',`<p>${context}</p>`,'Boston')})
 const jobs=await registered().run(f),audit=jobs[0].sourceNativeInventory
 assert.equal(jobs.length,1);assert.equal(audit.foreignCount,2);assert.equal(audit.countryUnknownCount,0)
 assert.equal(audit.scopeComplete,true);assert.equal(jobs[0].sourceListingComplete,true)
 assert.equal(readInventoryEvidence(jobs).status,'complete-inventory');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.deepEqual(audit.contextualCountryEvidence[0].alternatives.map(x=>x.worksite),['Madison, NJ','Manhattan','Greater Boston Area','South Florida Area','Greater Seattle Area, WA'])
 assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].closingDate,null)
})
test('an explicit Minneapolis Minnesota role worksite resolves foreign without using a city-only listing as evidence',async()=>{
 const f=fixture({
  'https://careers.brillio.com/wp-admin/admin-ajax.php':init=>{const page=Number(new URLSearchParams(init.body).get('paged'));return JSON.stringify({success:true,data:{html:page===1?card('1')+card('2','Dallas, United States'):card('3','Minneapolis'),pagination:pagination(page)}})},
  'https://careers.brillio.com/job-details?job-id=3':detail('3','<p>Location: Minneapolis, MN | Hybrid About Brillio</p><p>This position is based in Minneapolis, Minnesota, with a hybrid work arrangement.</p>','Minneapolis'),
 })
 const jobs=await registered().run(f),audit=jobs[0].sourceNativeInventory
 assert.equal(audit.foreignCount,2);assert.equal(audit.countryUnknownCount,0);assert.equal(audit.scopeComplete,true)
 assert.equal(audit.contextualCountryEvidence[0].country,'United States')
 assert.ok(audit.contextualCountryEvidence[0].alternatives.every(x=>x.referenceUrls.some(url=>url.startsWith('https://www.census.gov/'))))
})
test('a Fort Lauderdale header is corroborated by the role-owned South Florida worksite alternative',async()=>{
 const context='Location: Hybrid 3 days for these locations Madison, NJ/Manhattan, | Greater Boston Area |South Florida Area | Greater Seattle Area , WA As a consultant within the DE team, you will deliver software.'
 const f=fixture({
  'https://careers.brillio.com/wp-admin/admin-ajax.php':init=>{const page=Number(new URLSearchParams(init.body).get('paged'));return JSON.stringify({success:true,data:{html:page===1?card('1')+card('2','Dallas, United States'):card('3','Fort Lauderdale'),pagination:pagination(page)}})},
  'https://careers.brillio.com/job-details?job-id=3':detail('3',`<p>${context}</p>`,'Fort Lauderdale'),
 })
 const jobs=await registered().run(f),audit=jobs[0].sourceNativeInventory
 assert.equal(audit.foreignCount,2)
 assert.equal(audit.countryUnknownCount,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.ok(audit.contextualCountryEvidence[0].alternatives.some(a=>a.worksite==='South Florida Area'&&a.referenceUrls.some(url=>url.startsWith('https://www.fortlauderdale.gov/'))))
})
test('Fort Lauderdale requires matching role-owned regional context and every alternative must remain verified',()=>{
 for(const statement of [
  'Our headquarters is in South Florida Area.',
  'Client Location: South Florida Area',
  'Location: Greater Boston Area',
  'Location: South Florida Area | Unverified Harbor',
  'Location: South Florida Area | Bangalore, India',
 ]){
  const result=resolveWorksiteCountry({location:'Fort Lauderdale',description:statement,complete:true})
  assert.equal(result.country,null,statement)
 }
})
test('unknown or conflicting worksite alternatives and client or headquarters mentions do not resolve a city-only posting',async()=>{
 for(const context of [
  'Our headquarters is in Minneapolis, Minnesota. Clients are in Greater Boston Area. Salary: 120000 USD.',
  'Location: Hybrid 3 days for these locations Madison, NJ/Manhattan, | Greater Boston Area |South Florida Area | Greater Seattle Area, WA | Unverified Harbor As a consultant you will deliver software.',
  'Location: Hybrid 3 days for these locations Madison, NJ/Manhattan, | Greater Boston Area |South Florida Area | Greater Seattle Area, WA | Bangalore, India As a consultant you will deliver software.',
 ]){
  const f=fixture({'https://careers.brillio.com/job-details?job-id=3':detail('3',`<p>${context}</p>`,'Boston')}),jobs=await registered().run(f)
  assert.equal(jobs[0].sourceNativeInventory.countryUnknownCount,1);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 }
})
test('a worksite clause from a mismatched native role cannot resolve a listing country',async()=>{
 const f=fixture({'https://careers.brillio.com/job-details?job-id=3':detail('99','<p>Location: Hybrid 3 days for these locations Madison, NJ/Manhattan, | Greater Boston Area |South Florida Area | Greater Seattle Area, WA As a consultant you will deliver software.</p>','Boston','3')})
 const jobs=await registered().run(f);assert.equal(jobs[0].sourceNativeInventory.countryUnknownCount,1);assert.equal(jobs[0].sourceListingComplete,false)
})
test('Headquarters Location is a company field and cannot resolve a Minneapolis role country',()=>{
 const result=resolveWorksiteCountry({location:'Minneapolis',description:'Headquarters Location:Minneapolis,MN About Brillio',complete:true})
 assert.equal(result.country,null);assert.deepEqual(result.contexts,[])
})
test('Client Location is a client field and cannot resolve a Boston role country',async()=>{
 const result=resolveWorksiteCountry({location:'Boston',description:'Client Location:Greater Boston Area As a consultant',complete:true})
 assert.equal(result.country,null);assert.deepEqual(result.contexts,[])
 const f=fixture({'https://careers.brillio.com/job-details?job-id=3':detail('3','<p>Client Location:Greater Boston Area As a consultant</p>','Boston')})
 const jobs=await registered().run(f);assert.equal(jobs[0].sourceNativeInventory.countryUnknownCount,1);assert.equal(jobs[0].sourceListingComplete,false)
})
test('a direct statement about this position remains role-owned worksite evidence',()=>{
 const result=resolveWorksiteCountry({location:'Minneapolis',description:'This position is based in Minneapolis, Minnesota, with a hybrid work arrangement.',complete:true})
 assert.equal(result.country,'United States');assert.deepEqual(result.contexts,['Minneapolis, Minnesota'])
})
test('a Location field under a company heading cannot become role-owned evidence',async()=>{
 const f=fixture({'https://careers.brillio.com/job-details?job-id=3':detail('3','<h2>About the client</h2><p>Location: Greater Boston Area</p>','Boston')})
 const jobs=await registered().run(f);assert.equal(jobs[0].sourceNativeInventory.countryUnknownCount,1);assert.equal(jobs[0].sourceListingComplete,false)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {CAREER_PAGE_URL,JOBS_AJAX_URL,run,extractJobsFromAjaxHtml,extractLoadMoreRequestMetadata,hasOfficialCareerPageSignal} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-authority-20261128.json.gz',import.meta.url))))
const now=()=> '2026-11-28T02:00:00.000Z'
const next=page=>`<div class="awsm-jobs-pagination"><button class="awsm-load-more-btn" data-page="${page}">Load more</button></div>`
const empty='<div class="awsm-no-more-jobs-container"><p>Sorry! No more jobs to show.</p></div>'
const career=`<html><head><title>Career &#8211; SmartSoC Solutions</title><link rel="canonical" href="${CAREER_PAGE_URL}"></head><body><nav><a href="${CAREER_PAGE_URL}">Career</a></nav><h2>Fresher Hiring</h2><h2>We are ready for you. Are you too?</h2><div class="awsm-job-wrap"><input name="awsm_pagination_base" value="${CAREER_PAGE_URL}"><div class="awsm-job-listings" data-listings="10">${next(1)}</div></div></body></html>`
const card=(locations,{id='16931',title='Native role',url='https://www.smartsocs.com/jobs/native-role/'}={})=>`<div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-${id}"><a href="${url}" class="awsm-job-item"><h2 class="awsm-job-post-title">${title}</h2><div class="awsm-job-specification-job-category"><span class="awsm-job-specification-term">Silicon</span></div><div class="awsm-job-specification-job-location">${locations.map(v=>`<span class="awsm-job-specification-term">${v}</span>`).join('')}</div></a></div>`
const replay=async(payload,{onAudit,onRecords,provider=false}={})=>{
 const requests=[]
 const fetchText=async(url,options)=>{requests.push({url,options});if(requests.length===1){assert.equal(url,CAREER_PAGE_URL);return career}assert.equal(url,JOBS_AJAX_URL);return requests.length===2?payload:empty}
 const options={fetchText,now,onAudit,onRecords}
 const jobs=provider?await createCatalogScraper(getScraperCatalog().find(p=>p.source==='smartsocsolutions')).run(options):await run(options)
 return{jobs,requests}
}

test('actual current authority fixture retains three genuine bodies without asserting native jobs or a registered success',()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.validCurrentCheck,false);assert.equal(fixture.publisherProgramsExecuted,false);assert.equal(fixture.jobRecordsPresent,0)
 assert.equal(fixture.packets.length,3)
 for(const p of fixture.packets)assert.equal(createHash('sha256').update(p.body).digest('hex'),p.sha256)
 assert.equal(hasOfficialCareerPageSignal(fixture.packets[0].body),false)
 assert.equal(hasOfficialCareerPageSignal(fixture.packets[1].body),false)
})
test('current career remains a hold and never invents page1/loadmore from globally loaded plugin',async()=>{
 let requests=0
 await assert.rejects(run({now,fetchText:async()=>{requests++;assert.equal(requests,1);return fixture.packets[0].body}}),/career page no longer matches/)
 assert.equal(requests,1)
})
test('bare corporate identity cannot synthesize the old default ten-per-page metadata',()=>{
 const bare=career.replace(/<div class="awsm-job-wrap">[\s\S]*<\/div><\/body>/,'</body>')
 assert.throws(()=>extractLoadMoreRequestMetadata(bare),/contract|carrier|metadata/)
})
test('legacy metadata requires a genuine active listings owner, pagination base and explicit current control',()=>{
 assert.deepEqual(extractLoadMoreRequestMetadata(career),{action:'loadmore',listingsPerPage:10,paginationBase:CAREER_PAGE_URL})
 for(const html of[career.replace('data-listings="10"',''),career.replace('data-listings="10"','data-listings="0"'),career.replace(next(1),''),career.replace('name="awsm_pagination_base"','name="unrelated"'),career.replace('class="awsm-job-wrap"','class="unrelated"')])assert.throws(()=>extractLoadMoreRequestMetadata(html),/contract|carrier|metadata|owner/)
})
test('an unrelated pagination control outside the native listings owner cannot authorize a POST',()=>{
 const unrelated=career.replace(next(1),'').replace('</body>',next(1)+'</body>')
 assert.throws(()=>extractLoadMoreRequestMetadata(unrelated),/contract|carrier|metadata|owner/)
})
test('only all-literal native India prefixes support India, with raw card and location alternatives retained',()=>{
 const html=card(['India: Bangalore','India: Hyderabad']),[job]=extractJobsFromAjaxHtml(html)
 assert.equal(job.country,'India');assert.equal(job.location,'Bangalore; Hyderabad, India');assert.equal(job.city,'Bangalore')
 assert.deepEqual(job.sourceNativeLocationValues,['India: Bangalore','India: Hyderabad']);assert.equal(job.sourceNativeCardHTML,html)
 assert.equal(job.applyUrl,null);assert.equal(job.remoteStatus,null);assert.equal(job.sourceDetailComplete,false)
 assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceApplicationAuthority,false)
})
for(const [label,locations]of[['city-only',['Bangalore']],['mixed',['India: Hyderabad','USA: Delaware']],['foreign',['Sweden: Stockholm']],['absent',[]],['blank native India',['India: ']],['city plus explicit India',['Bangalore','India: Hyderabad']]]){
 test(label+' location alternatives stay raw and cannot become an India role',()=>{
  const html=card(locations),[job]=extractJobsFromAjaxHtml(html)
  assert.ok(job);assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.applyUrl,null);assert.equal(job.remoteStatus,null)
  assert.equal(job.sourceNativeCardHTML,html);assert.deepEqual(job.sourceNativeLocationValues,locations.map(v=>v.trim()))
  assert.equal(job.sourceCountryEvidence.qualified,false)
 })
}
test('controlled legacy collection retains every full raw record while returning only unambiguous explicit India',async()=>{
 const cards=[card(['India: Bangalore']),card(['USA: Delaware'],{id:'2'}),card(['India: Hyderabad','Sweden: Stockholm'],{id:'3'}),card(['Bangalore'],{id:'4'})]
 let audit,records
 const {jobs}=await replay(cards.join('')+next(2),{onAudit:v=>{audit=v},onRecords:v=>{records=v}})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].applyUrl,null);assert.equal(jobs[0].remoteStatus,null)
 assert.equal(records.length,4);assert.deepEqual(records.map(r=>r.sourceNativeCardHTML),cards);assert.equal(audit.observations.length,4)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.applicationAuthority,false);assert.equal(audit.detailCriteriaQualified,false)
})
test('actual assessment boundary cannot normalize unknown countries back into India or verified zero',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='smartsocsolutions')
 const {jobs}=await replay(card(['Bangalore'])+card(['India: Hyderabad','USA: Delaware'],{id:'2'})+next(2),{provider:true})
 const result=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(jobs.length,0);assert.equal(result.indiaJobs,0);assert.equal(result.eligibleJobs,0);assert.equal(result.runnerOutcome.success,false)
 assert.equal(result.runnerOutcome.partial,true);assert.equal(result.runnerOutcome.rawRecords,2)
 assert.equal(result.inventoryEvidence.status,'discovery-only');assert.equal(result.inventoryEvidence.listingComplete,false);assert.equal(result.inventoryEvidence.lifecycleCleanupAllowed,false)
 assert.deepEqual(result.cleanupOptions,{replaceExisting:false})
})
test('explicit India discovery stays partial and the catalog navigation fallback has no application authority',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='smartsocsolutions')
 const {jobs}=await replay(card(['India: Bangalore'])+next(2),{provider:true})
 const result=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceApplicationAuthority,false)
 assert.equal(jobs[0].remoteStatus,null);assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(result.eligibleJobs,1);assert.equal(result.runnerOutcome.partial,true);assert.equal(result.inventoryEvidence.listingComplete,false)
 assert.equal(jobs.filter(job=>job.sourceDetailComplete===true).length,0)
 assert.deepEqual(result.cleanupOptions,{replaceExisting:false})
})
test('native terminal empty is held with unknown company totals and no cleanup authority',async()=>{
 let audit
 const{jobs}=await replay(empty,{onAudit:v=>{audit=v},provider:true})
 const result=assessSoftFailureAcquisition(getScraperCatalog().find(p=>p.source==='smartsocsolutions'),jobs)
 assert.equal(jobs.length,0);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(result.runnerOutcome.success,false);assert.equal(result.runnerOutcome.partial,true);assert.equal(result.inventoryEvidence.status,'discovery-only');assert.deepEqual(result.cleanupOptions,{replaceExisting:false})
})
test('a page without a next control or terminal marker cannot invent the next request or return positives',async()=>{
 let calls=0
 await assert.rejects(run({now,fetchText:async()=>++calls===1?career:card(['India: Bangalore'])}),/pagination|control/)
 assert.equal(calls,2)
})
test('backward/repeated or out-of-budget page controls are terminal before another request',async()=>{
 for(const page of[1,0,11]){let calls=0;await assert.rejects(run({now,fetchText:async()=>++calls===1?career:card(['India: Bangalore'])+next(page)}),/pagination|control|page/);assert.equal(calls,2)}
})
test('duplicate native identities and contradictory empty/card states cannot silently drop evidence',()=>{
 assert.throws(()=>extractJobsFromAjaxHtml(card(['India: Bangalore'])+card(['India: Hyderabad'])),/duplicate|identity/)
 assert.throws(()=>extractJobsFromAjaxHtml(card(['India: Bangalore'])+empty),/empty|conflict|contradict/)
})
test('inert-only cards and foreign native role URLs do not produce trusted jobs',()=>{
 assert.throws(()=>extractJobsFromAjaxHtml('<template>'+card(['India: Bangalore'])+'</template>'),/trusted|card/)
 assert.throws(()=>extractJobsFromAjaxHtml(card(['India: Bangalore'],{url:'https://unrelated.invalid/jobs/native-role/'})),/identity|URL|card/)
})
test('audit callback mutation cannot change original raw records or emitted jobs',async()=>{
 let records
 const{jobs}=await replay(card(['India: Bangalore'])+next(2),{onRecords:v=>{records=v;v[0].country='USA'},onAudit:v=>{v.observations[0].country='USA';v.companyIndiaTotal=999}})
 assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceCountryEvidence.qualified,true);assert.equal(records[0].country,'USA')
})
test('opaque caller cancellation is preserved before the first read and after an awaited injected page',async()=>{
 for(const reason of[null,{opaque:'caller'}]){
  const pre=new AbortController();pre.abort(reason);let calls=0
  await assert.rejects(run({signal:pre.signal,fetchText:async()=>{calls++;return career}}),e=>e===reason);assert.equal(calls,0)
  const late=new AbortController()
  await assert.rejects(run({signal:late.signal,fetchText:async()=>{late.abort(reason);return career}}),e=>e===reason)
 }
})
test('ordinary page transport validates HTTP403/429 and HTTP200 challenge headers before body parsing',async()=>{
 const original=globalThis.fetch
 try{for(const[status,headers]of[[403,{}],[429,{}],[200,{'cf-mitigated':'challenge'}],[200,{'x-amzn-waf-action':'challenge'}]]){
  let calls=0
  globalThis.fetch=async(url,init)=>{calls++;assert.equal(String(url),CAREER_PAGE_URL);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');return Object.defineProperty(new Response(career,{status,headers}),'url',{value:CAREER_PAGE_URL})}
  await assert.rejects(run({now}),e=>e.httpStatus===status&&e.abortRetries===true&&e.failureKind==='blocked_or_access_denied');assert.equal(calls,1)
 }}finally{globalThis.fetch=original}
})
test('ordinary page transport rejects a foreign response identity before any native POST',async()=>{
 const original=globalThis.fetch;let calls=0
 try{
  globalThis.fetch=async()=>{calls++;return Object.defineProperty(new Response(career,{status:200}),'url',{value:'https://foreign.invalid/career/'})}
  await assert.rejects(run({now}),e=>e.failureKind==='parser_or_contract_error'&&e.abortRetries===true&&e.responseUrl==='https://foreign.invalid/career/')
  assert.equal(calls,1)
 }finally{globalThis.fetch=original}
})
test('ordinary streamed response byte bound disposes and releases its owned reader',async()=>{
 const original=globalThis.fetch;let cancelled=0,released=0,calls=0
 const reader={read:async()=>({done:false,value:new Uint8Array(4*1024*1024+1)}),cancel:async()=>{cancelled++},releaseLock:()=>{released++}}
 try{
  globalThis.fetch=async()=>{calls++;return{status:200,url:CAREER_PAGE_URL,headers:new Headers(),body:{getReader:()=>reader}}}
  await assert.rejects(run({now}),/byte bound/)
  assert.equal(calls,1);assert.equal(cancelled,1);assert.equal(released,1)
 }finally{globalThis.fetch=original}
})
test('opaque null abort during ordinary body read cancels and releases its owned reader',async()=>{
 const original=globalThis.fetch,controller=new AbortController();let cancelled=0,released=0
 const reader={read:async()=>{controller.abort(null);return{done:false,value:Buffer.from(career)}},cancel:async()=>{cancelled++},releaseLock:()=>{released++}}
 try{
  globalThis.fetch=async()=>({status:200,url:CAREER_PAGE_URL,headers:new Headers(),body:{getReader:()=>reader}})
  await assert.rejects(run({now,signal:controller.signal}),e=>e===null)
  assert.equal(cancelled,1);assert.equal(released,1)
 }finally{globalThis.fetch=original}
})

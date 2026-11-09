import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {publishedIndiaLocationFacets,reviewedWorkdayEmployerDeclaration} from '../scraper-support/utils/recruitmentWorkdayContext.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/workday-country-office-native-quality.json.gz',import.meta.url))))
const capture=source=>fixture.sources.find(s=>s.source===source)
const key=(url,init={})=>(init.method||'GET')+':'+url+':'+(init.body||'')
function transport(source,mutate=()=>{}){
 const pending=new Map(),calls=[]
 for(const p of capture(source).requests){const id=key(p.requestedURL,{method:p.method,body:p.body});const rows=pending.get(id)||[];rows.push(structuredClone(p));pending.set(id,rows)}
 return{calls,get remaining(){return[...pending.values()].reduce((n,rows)=>n+rows.length,0)},async fetch(url,init={}){
  const rows=pending.get(key(String(url),init));assert.ok(rows?.length,'Uncaptured native request: '+url)
  const p=rows.shift();mutate(p,calls.length+1);calls.push({url:String(url),init,packet:p})
  if(p.error)throw Error(p.error)
  const response=new Response(p.text,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalURL});return response
 }}
}
async function replay(source,mutate,options={}){
 const read=transport(source,mutate),prior=globalThis.fetch
 globalThis.fetch=(...args)=>read.fetch(...args)
 try{const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source===source)).run({
  fetchImpl:(...args)=>read.fetch(...args),requestIntervalMs:0,now:()=>capture(source).completedAt,...options})
  return{jobs,read}
 }finally{globalThis.fetch=prior}
}
const changeDetails=fn=>p=>{if(p.requestedURL.includes('/job/')){const d=JSON.parse(p.text);fn(d,p);p.text=JSON.stringify(d)}}

test('the two current native contracts retain 53 unmodified original responses and production pacing',()=>{
 const packets=[...fixture.sources.flatMap(s=>s.requests),...fixture.relatedDocuments]
 assert.equal(packets.length,53)
 for(const p of packets){assert.equal(p.replayed,false);assert.equal(createHash('sha256').update(p.text).digest('hex'),p.bodySHA256)}
 for(const source of fixture.sources){const prior=new Map();for(const p of source.requests){const origin=new URL(p.requestedURL).origin,start=Date.parse(p.startedAt)
  if(prior.has(origin))assert.ok(start-prior.get(origin)>=850,'Unpaced public origin: '+origin);prior.set(origin,start)}}
})
for(const[source,count,legal]of[['telstra',6,5],['aspentechnology',14,4]])test(source+' registered route preserves every full native role and original employer/date/worksite fields',async()=>{
 const {jobs,read}=await replay(source)
 assert.equal(jobs.length,count);assert.equal(read.remaining,0);assert.deepEqual(jobs.map(j=>j.jobId),capture(source).expected.ids)
 assert.equal(new Set(jobs.map(j=>j.jobId)).size,count)
 assert.equal(jobs.filter(j=>j.nativeLegalEmployer).length,legal)
 for(const j of jobs){const v=j.nativeSourceRecord.jobPostingInfo
  assert.equal(j.jobId,v.jobReqId);assert.equal(j.requisitionId,v.jobReqId);assert.equal(j.title,v.title)
  assert.equal(j.country,'India');assert.equal(v.country.descriptor,'India');assert.equal(v.jobRequisitionLocation.country.alpha2Code,'IN')
  assert.equal(j.sourceDescription,v.jobDescription);assert.equal(j.sourceDetailComplete,true);assert.equal(j.publicExperienceChecked,true)
  assert.equal(j.employmentType,typeof v.timeType==='string'&&v.timeType.trim()?v.timeType:null)
  assert.equal(j.postingDate,v.startDate);assert.equal(j.postedAt,v.startDate);assert.equal(j.sourcePostedDateRaw,v.startDate)
  assert.equal(j.postingDatePrecision,'calendar-date');assert.equal(j.firstEverPostedAt,null)
  assert.equal(j.closingDate,v.endDate||null);assert.equal(j.sourceClosingDateIsExact,false)
  assert.equal(j.city,null);assert.equal(j.location,v.location)
  assert.deepEqual(j.nativeLocationEvidence.requisitionLocation,v.jobRequisitionLocation)
  assert.equal(j.nativeClosingSourceRecord.jobPostingInfo.jobDescription,v.jobDescription)
  assert.equal(j.sourceOfficialBinding.currentHandoffRechecked,true)
  assert.equal(j.sourceNativeClosingContext.allSelectedListingPagesRechecked,true)
  assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)
  assert.equal(j.applyUrl,j.sourceUrl);assert.equal(j.applicationVisited,false)
  if(!j.nativeSourceRecord.hiringOrganization.name){assert.equal(j.nativeLegalEmployer,null);assert.equal(j.nativeEmployerBinding.method,'explicit-native-role-employment-declaration')}
  else assert.deepEqual(j.nativeHiringOrganization,j.nativeSourceRecord.hiringOrganization)
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('Telstra uses its actual Location_Country facet rather than a mixed-country India text search',async()=>{
 const {jobs,read}=await replay('telstra'),search=read.calls.filter(c=>c.init.method==='POST').map(c=>JSON.parse(c.init.body))
 assert.equal(jobs.length,6);assert.deepEqual(search.map(s=>s.appliedFacets),[{},
  {Location_Country:['c4f78be1a8f14da0ab49ce1162348a5e']},{Location_Country:['c4f78be1a8f14da0ab49ce1162348a5e']}])
 assert.ok(search.every(s=>s.searchText===''))
})
test('Aspen follows the published current India office ID and preserves conflicting native city labels',async()=>{
 const {jobs,read}=await replay('aspentechnology'),posts=read.calls.filter(c=>c.init.method==='POST').map(c=>JSON.parse(c.init.body))
 assert.deepEqual(posts.map(p=>p.appliedFacets),[{},
  {locations:['e15888bd58031000ffdf467c8c250000']},{locations:['e15888bd58031000ffdf467c8c250000']}])
 const noida=jobs.find(j=>j.jobId==='R9094')
 assert.equal(noida.location,'Bengaluru, India');assert.equal(noida.nativeLocationEvidence.requisitionLocation.descriptor,'Noida');assert.equal(noida.city,null)
 assert.ok(jobs.every(j=>j.nativeSourceRecord.jobPostingInfo.jobPostingSiteId==='AspenTech'))
})
test('native office discovery excludes Indiana and cannot infer country from city-only labels',()=>{
 const payload={facets:[{facetParameter:'locationMainGroup',values:[{facetParameter:'locations',values:[
  {id:'1'.repeat(32),descriptor:'Bengaluru, India',count:14},{id:'2'.repeat(32),descriptor:'South Bend, Indiana, USA',count:3},
  {id:'3'.repeat(32),descriptor:'Bengaluru',count:9}]}]}]}
 assert.deepEqual(publishedIndiaLocationFacets(payload).map(v=>v.id),['1'.repeat(32)])
 payload.facets[0].values[0].values.push({...payload.facets[0].values[0].values[0]})
 assert.throws(()=>publishedIndiaLocationFacets(payload),/Duplicate/)
})
for(const[name,fn]of[
 ['conflicting country',d=>d.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US'],
 ['unrecognized country ID',d=>d.jobPostingInfo.country.id='f'.repeat(32)],
 ['missing country',d=>delete d.jobPostingInfo.country],
 ['posting site',d=>d.jobPostingInfo.jobPostingSiteId='Foreign'],
 ['posting UID',d=>d.jobPostingInfo.id='bad'],
 ['requisition',d=>d.jobPostingInfo.jobReqId='R000000'],
 ['canonical posting ID',d=>d.jobPostingInfo.jobPostingId='unrelated'],
 ['future publication',d=>d.jobPostingInfo.startDate='2099-01-01'],
 ['invalid calendar publication',d=>d.jobPostingInfo.startDate='2026-02-30'],
])test('the current native context holds '+name+' without claiming verified empty',async()=>{
 const {jobs}=await replay('aspentechnology',changeDetails(fn));assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('duplicate native posting UIDs cannot qualify different requisitions',async()=>{
 const {jobs}=await replay('aspentechnology',changeDetails(d=>d.jobPostingInfo.id='a'.repeat(32)))
 assert.equal(jobs.length,0)
})
test('an explicit unrelated structured employer overrides no own-brand introduction',async()=>{
 const {jobs}=await replay('aspentechnology',changeDetails(d=>d.hiringOrganization.name='Unrelated Emerson Company'))
 assert.equal(jobs.length,0)
})
test('missing own AspenTech employment introductions stay held and never borrow OSI legal names',async()=>{
 const {jobs}=await replay('aspentechnology',changeDetails(d=>{if(!d.hiringOrganization.name)
  d.jobPostingInfo.jobDescription=d.jobPostingInfo.jobDescription.replace('The driving force behind our success has always been the people of AspenTech.','A different organization employs this team.')}))
 assert.equal(jobs.length,4);assert.ok(jobs.every(j=>j.nativeLegalEmployer==='OSI Energy Automation India Private Limited'))
})
test('reviewed employer declarations reject quoted, hidden and misplaced introductions',()=>{
 const contract={name:'AspenTech',kind:'first-paragraph-employment-introduction',prefix:'The driving force behind our success has always been the people of AspenTech.'}
 const html='<p>'+contract.prefix+' We build software.</p>'
 assert.equal(reviewedWorkdayEmployerDeclaration(html,contract).legalEmployer,null)
 for(const bad of['<blockquote>'+html+'</blockquote>','<div hidden>'+html+'</div>','<p>A reference to another company.</p>'+html])
  assert.equal(reviewedWorkdayEmployerDeclaration(bad,contract),null)
})
test('Telstra blank legal identity requires its own exact statement, with no sibling substitution',async()=>{
 const {jobs}=await replay('telstra',changeDetails(d=>{if(!d.hiringOrganization.name)d.jobPostingInfo.jobDescription=d.jobPostingInfo.jobDescription.replace('Telstra is Australia','Another firm is Australia')}))
 assert.equal(jobs.length,5);assert.ok(jobs.every(j=>j.nativeLegalEmployer))
})
test('closing full native role drift invalidates the affected board',async()=>{
 const seen=new Map()
 const {jobs}=await replay('aspentechnology',p=>{if(p.requestedURL.includes('/job/')){const n=(seen.get(p.requestedURL)||0)+1;seen.set(p.requestedURL,n);if(n===2){const d=JSON.parse(p.text);d.jobPostingInfo.jobDescription+='<p>Changed criteria.</p>';p.text=JSON.stringify(d)}}})
 assert.equal(jobs.length,0)
})
test('closing native listing drift cannot authorize returned jobs or cleanup',async()=>{
 let reads=0
 const {jobs}=await replay('telstra',p=>{if(p.method==='POST'&&JSON.parse(p.body).appliedFacets.Location_Country&&++reads===2){const d=JSON.parse(p.text);d.total++;p.text=JSON.stringify(d)}})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('closing company handoff changes invalidate candidates',async()=>{
 let reads=0
 const {jobs}=await replay('aspentechnology',p=>{if(p.requestedURL==='https://www.aspentech.com/en/careers'&&++reads===2)p.text='<title>AspenTech Careers</title><p>Unavailable</p>'})
 assert.equal(jobs.length,0)
})
for(const source of['telstra','aspentechnology'])test(source+' current company denial stops before any native-account fallback',async()=>{
 const read=transport(source,p=>p.status=403),prior=globalThis.fetch;globalThis.fetch=(...args)=>read.fetch(...args)
 try{await assert.rejects(createCatalogScraper(getScraperCatalog().find(p=>p.source===source)).run({fetchImpl:(...args)=>read.fetch(...args),requestIntervalMs:0}),/unavailable/i)
  assert.equal(read.calls.length,1)
 }finally{globalThis.fetch=prior}
})
test('a native detail denial stops further public reads and leaves zero unqualified output',async()=>{
 const {jobs,read}=await replay('aspentechnology',p=>{if(p.requestedURL.includes('/job/'))p.status=403})
 assert.equal(jobs.length,0);assert.equal(read.calls.at(-1).packet.status,403)
})
for(const source of['telstra','aspentechnology'])test(source+' caps and cancellation cause no public requests',async()=>{
 const {jobs,read}=await replay(source,undefined,{maxJobs:0});assert.equal(jobs.length,0);assert.equal(read.calls.length,0)
 await assert.rejects(replay(source,undefined,{signal:AbortSignal.abort(Error('caller cancelled'))}),/caller cancelled/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {WorkdayHostCircuitBreaker} from '../scraper-support/myworkday/engine.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {WORKDAY_COUNTRY_INVENTORY_PROOF} from '../scraper-support/myworkday/countryInventoryProof.js'
import {withRecordedWorkdayClock} from './helpers/workdayRecordedClock.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/coke-conoco-native-country-quality.json.gz',import.meta.url))))
const capture=source=>fixture.sources.find(s=>s.source===source)
const key=(url,init={})=>(init.method||'GET')+':'+url+':'+(init.body||'')
const API='https://coke.wd1.myworkdayjobs.com/wday/cxs/coke/coca-cola-careers/jobs'
function transport(source,mutate=()=>{}){
 const pending=new Map(),calls=[]
 for(const p of capture(source).requests){const id=key(p.requestedURL,{method:p.method,body:p.body}),rows=pending.get(id)||[];rows.push(structuredClone(p));pending.set(id,rows)}
 return{calls,get remaining(){return[...pending.values()].reduce((n,rows)=>n+rows.length,0)},async fetch(url,init={}){
  const rows=pending.get(key(String(url),init));assert.ok(rows?.length,'Uncaptured native HTTP request: '+url)
  const p=rows.shift();mutate(p,calls.length+1);calls.push({url:String(url),method:init.method||'GET',packet:p})
  const response=new Response(p.text,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalURL});return response
 }}
}
async function replay(source,mutate,options={}){
 const read=transport(source,mutate),prior=globalThis.fetch;globalThis.fetch=(...args)=>read.fetch(...args)
 try{return await withRecordedWorkdayClock(capture(source).startedAt,async()=>{
  const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source===source)).run({
   now:()=>capture(source).completedAt,requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}},retryBaseDelayMs:0,
   circuitBreaker:new WorkdayHostCircuitBreaker(),detailCircuitBreaker:new WorkdayHostCircuitBreaker(),...options})
  return{jobs,read}
 })}finally{globalThis.fetch=prior}
}
const details=fn=>p=>{if(p.requestedURL.includes('/job/')){const d=JSON.parse(p.text);fn(d,p);p.text=JSON.stringify(d)}}

test('the current source fixture retains 205 original unmodified HTTP bodies',()=>{
 const packets=fixture.sources.flatMap(s=>s.requests);assert.equal(packets.length,205)
 for(const p of packets){assert.equal(p.replayed,false);assert.equal(createHash('sha256').update(p.text).digest('hex'),p.bodySHA256)}
})
test('Coca-Cola registered route reconciles its full 252-role board and preserves all five native India roles',async()=>{
 const {jobs,read}=await replay('cocacola')
 assert.equal(read.remaining,0);assert.equal(jobs.length,5);assert.deepEqual(jobs.map(j=>j.jobId),capture('cocacola').expected.ids)
 for(const j of jobs){const v=j.nativeSourceRecord.jobPostingInfo,b=j.sourceBoardInventories[0]
  assert.equal(j.jobId,v.jobReqId);assert.equal(j.requisitionId,v.jobReqId);assert.equal(j.title,v.title)
  assert.equal(j.sourceDescription,v.jobDescription);assert.equal(j.sourceDetailComplete,true)
  assert.deepEqual(j.nativeHiringOrganization,j.nativeSourceRecord.hiringOrganization)
  assert.equal(j.nativeLegalEmployer,j.nativeSourceRecord.hiringOrganization.name)
  assert.equal(j.postingDate,v.startDate);assert.equal(j.postedAt,v.startDate);assert.equal(j.sourcePostedDateRaw,v.startDate)
  assert.equal(j.postingDatePrecision,'calendar-date');assert.equal(j.firstEverPostedAt,null)
  assert.equal(j.closingDate,v.endDate);assert.equal(j.closingDatePrecision,'calendar-date');assert.equal(j.sourceClosingDateIsExact,false)
  assert.equal(j.employmentType,v.timeType||null)
  assert.equal(b.reportedTotal,252);assert.equal(b.pagesFetched,26);assert.equal(b.countryScopeComplete,true)
  assert.equal(b.unresolvedCountryRoles.length,0)
  assert.equal(b.reconciliation.initial.sha256,b.reconciliation.closing.sha256)
  assert.equal(j.country,'India');assert.equal(j.city,null);assert.ok(j.locations.every(label=>/^India\s+-\s+/.test(label)))
  assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)
  assert.equal(j.applicationVisited,false);assert.equal(j.sourceUrl,v.externalUrl);assert.equal(j.applyUrl,v.externalUrl)
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('foreign-primary roles retain India secondary sites without rewriting native countries',async()=>{
 const {jobs}=await replay('cocacola'),china=jobs.find(j=>j.jobId==='R-148671'),philippines=jobs.find(j=>j.jobId==='R-147670')
 assert.equal(china.nativeSourceRecord.jobPostingInfo.country.descriptor,'China')
 assert.equal(china.nativeLocationEvidence.primaryCountry.descriptor,'China')
 assert.deepEqual(china.locations,['India - Gurgaon','India - Pune'])
 assert.equal(philippines.nativeSourceRecord.jobPostingInfo.country.descriptor,'Philippines')
 assert.deepEqual(philippines.locations,['India - Gurgaon'])
 assert.equal(china.nativeHiringOrganization.name,'1251 Coca-Cola Beverages (Shanghai) Company Limited')
 assert.equal(philippines.nativeHiringOrganization.name,'1648 Coca-Cola Far East Limited - Philippines Branch')
})
test('a written foreign worksite country resolves the three formerly held Coke rows without changing India selection',async()=>{
 const {jobs}=await replay('cocacola'),proof=jobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
 assert.equal(proof.boards[0].countryScopeComplete,true);assert.equal(proof.boards[0].unresolvedCountryRoles.length,0)
 assert.equal(proof.observedIndiaJobCount,5);assert.equal(proof.completeSourceScope,false)
})
test('ConocoPhillips reconciles all 26 records while unresolved secondary-country scope remains uncredited',async()=>{
 const {jobs,read}=await replay('conocophillips'),proof=jobs[WORKDAY_COUNTRY_INVENTORY_PROOF],evidence=readInventoryEvidence(jobs)
 assert.equal(read.remaining,0);assert.equal(jobs.length,0)
 assert.equal(proof.boards[0].reportedTotal,26);assert.equal(proof.boards[0].pagesFetched,4)
 assert.equal(proof.boards[0].countryScopeComplete,false);assert.equal(proof.boards[0].unresolvedCountryRoles.length,1)
 assert.equal(proof.boards[0].reconciliation.initial.sha256,proof.boards[0].reconciliation.closing.sha256)
 assert.equal(proof.completeSourceScope,false);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
})
test('Coke native employer mismatches cannot use the parent source label as a fallback',async()=>{
 await assert.rejects(replay('cocacola',details(d=>{if(d.jobPostingInfo.jobReqId==='R-147806')d.hiringOrganization.name='Unrelated India Employer'})),/employer/i)
})
test('removing explicit India secondary sites cannot promote foreign-primary roles from a country filter or employer name',async()=>{
 const {jobs}=await replay('cocacola',details(d=>{if(['R-148671','R-147670'].includes(d.jobPostingInfo.jobReqId))d.jobPostingInfo.additionalLocations=d.jobPostingInfo.additionalLocations.filter(v=>!/^India\s+-/.test(v))}))
 assert.ok(jobs.every(j=>!['R-148671','R-147670'].includes(j.jobId)))
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
})
test('closing full native description changes invalidate the affected source snapshot',async()=>{
 const seen=new Map()
 await assert.rejects(replay('cocacola',p=>{if(p.requestedURL.includes('/job/')){const n=(seen.get(p.requestedURL)||0)+1;seen.set(p.requestedURL,n);if(n===2){const d=JSON.parse(p.text);d.jobPostingInfo.jobDescription+='<p>Changed responsibilities.</p>';p.text=JSON.stringify(d)}}}),/description|scope|mismatch/i)
})
test('Coke closing complete-board count drift remains incomplete',async()=>{
 let zero=0
 await assert.rejects(replay('cocacola',p=>{if(p.requestedURL===API&&JSON.parse(p.body).offset===0&&++zero===2){const d=JSON.parse(p.text);d.total++;p.text=JSON.stringify(d)}}),/count|incomplete|changed/i)
})
test('the exact advertised vanity301 remains mandatory before fetching the native board',async()=>{
 const read=transport('cocacola',p=>{if(p.requestedURL==='https://careers.coca-colacompany.com/')p.status=302}),prior=globalThis.fetch
 globalThis.fetch=(...args)=>read.fetch(...args)
 try{await withRecordedWorkdayClock(capture('cocacola').startedAt,()=>assert.rejects(createCatalogScraper(getScraperCatalog().find(p=>p.source==='cocacola')).run({
  requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}},retryBaseDelayMs:0})))
  assert.equal(read.calls.length,2)
 }finally{globalThis.fetch=prior}
})
for(const source of['cocacola','conocophillips'])test(source+' caps and caller cancellation cause no public reads',async()=>{
 const {jobs,read}=await replay(source,undefined,{maxJobs:0});assert.equal(jobs.length,0);assert.equal(read.calls.length,0)
 await assert.rejects(replay(source,undefined,{signal:AbortSignal.abort(Error('caller cancelled'))}),/caller cancelled/)
})

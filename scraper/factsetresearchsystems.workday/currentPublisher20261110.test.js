import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {recruitmentBatchProviders} from '../../scraper-support/utils/recruitmentBatch20261103.js'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-declared-board-20261110.json.gz',import.meta.url))))
const SOURCE='factsetresearchsystems',ROOT='https://www.factset.com/careers'
const BOARD='https://factset.wd108.myworkdayjobs.com/FactSetCareers'
const EMPLOYER='30097 FactSet Systems India Private Limited'
const expectedIds=['R31560','R32222','R32233','R32287','R32319','R32323','R32544','R32571','R32656','R32775','R32945','R33066','R33133','R33211','R33490','R33491','R33492']
const source=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source===SOURCE))
const editJson=(packet,change)=>{const payload=JSON.parse(packet.body);change(payload);packet.body=JSON.stringify(payload)}
function transport(change=()=>{}){
 const packets=structuredClone(fixture.captures);change(packets)
 const counts=new Map(),calls=[]
 return{calls,fetchImpl:async(url,init={})=>{
  const key=JSON.stringify([init.method||'GET',url,init.body||null]),index=counts.get(key)||0
  counts.set(key,index+1);calls.push({url,method:init.method||'GET',body:init.body||null,signal:init.signal})
  const candidates=packets.filter(p=>JSON.stringify([p.requestMethod,p.requestUrl,p.requestBody])===key)
  const packet=candidates[index]
  assert.ok(packet,'Unexpected or repeated public read: '+key+' #'+index)
  const result=new Response(packet.body,{status:packet.status,headers:{'content-type':packet.contentType}})
  Object.defineProperty(result,'url',{value:packet.finalUrl})
  return result
 }}
}
const run=async(change,options={})=>{
 const wire=transport(change)
 const jobs=await source().run({now:()=>fixture.capturedAt,fetchImpl:wire.fetchImpl,...options})
 return{jobs,calls:wire.calls,observed:jobs[RECRUITMENT_OBSERVATIONS]}
}
async function held(change,reason){
 let jobs,error,observed
 try{({jobs,observed}=await run(change))}catch(failure){error=failure;observed=failure.recruitmentObservations}
 assert.equal(jobs?.length||0,0,'unqualified current handoff or native context must not publish jobs')
 assert.ok(observed,'failure must retain recruitment observations')
 const diagnostics=[error?.message,...(observed.failures||[]).map(row=>row.message),...(observed.unresolved||[])].join(' | ')
 if(reason)assert.match(diagnostics,reason)
 return observed
}
const packet=(packets,label)=>{const p=packets.find(row=>row.label===label);assert.ok(p,label);return p}

test('registered FactSet follows its current publisher declaration and retains seventeen own subsidiary India jobs',async()=>{
 const {jobs,calls,observed}=await run()
 assert.equal(jobs.length,17)
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),expectedIds)
 assert.ok(jobs.every(j=>j.source===SOURCE&&j.company===EMPLOYER&&j.country==='India'))
 assert.ok(jobs.every(j=>j.nativeLegalEmployer===EMPLOYER&&j.nativeHiringOrganization.name===EMPLOYER))
 assert.ok(jobs.every(j=>j.nativeSourceRecord.hiringOrganization.name===EMPLOYER&&j.nativeClosingSourceRecord.hiringOrganization.name===EMPLOYER))
 assert.ok(jobs.every(j=>j.nativeEmployerBinding.method==='verified-subsidiary-on-current-official-board'))
 assert.ok(jobs.every(j=>j.sourceDescription===j.nativeSourceRecord.jobPostingInfo.jobDescription&&j.jobDescription===j.sourceDescription&&j.sourceDescription.length>6000))
 assert.ok(jobs.every(j=>j.nativeSourceRecord.jobPostingInfo.country.descriptor==='India'&&j.nativeSourceRecord.jobPostingInfo.jobRequisitionLocation.country.alpha2Code==='IN'))
 const recent=jobs.find(j=>j.jobId==='R33211')
 assert.equal(recent.postingDate,'2026-11-09');assert.equal(recent.nativePostingDate,'2026-11-09');assert.equal(recent.sourcePostedDateRaw,'2026-11-09')
 assert.equal(JSON.parse(JSON.stringify(recent)).nativeLegalEmployer,EMPLOYER,'the actual legal employer must survive runtime serialization')
 assert.equal(recent.sourceOfficialBinding.bindingMethod,'runtime-current-careers-publisher-declaration')
 assert.equal(recent.sourceOfficialBinding.currentHandoffRechecked,true)
 assert.ok(jobs.every(j=>j.sourceNativeClosingContext.eachFullRoleRechecked&&j.sourceNativeClosingContext.allSelectedListingPagesRechecked))
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(observed.lifecycleCleanupAllowed,false)
 assert.equal(observed.sourceScopeComplete,false)
 assert.ok(observed.exclusions.some(row=>row.country==='United Kingdom'))
 assert.equal(observed.publisherDeclarations.length,2)
 assert.equal(observed.publisherDeclarations[0].payloads.careers.content.sections[0].cta.href,BOARD)
 assert.match(JSON.stringify(observed.publisherDeclarations[0].payloads.legal),/FactSet Research Systems/)
 assert.equal(calls.length,48)
 assert.equal(calls.filter(c=>c.url===ROOT).length,2)
 assert.equal(calls.filter(c=>c.url===BOARD).length,2)
 assert.equal(calls.filter(c=>c.url.endsWith('/jobs')).length,3)
})

test('FactSet rejects an unrelated current corporate publisher before requesting a board',async()=>{
 await held(packets=>{for(const p of packets.filter(p=>p.requestUrl===ROOT))p.body=p.body.replaceAll('FactSet','Different Employer')},/current-corporate-publisher-identity-unqualified/)
})
test('FactSet standard normalization preserves the actual subsidiary company, original publication and cleanup hold',async()=>{
 const {jobs}=await run(),provider=getScraperCatalog().find(p=>p.source===SOURCE)
 const job=normalizeScrapedJob(jobs.find(job=>job.jobId==='R33211'),provider)
 assert.equal(job.company,EMPLOYER)
 assert.equal(job.source,SOURCE)
 assert.equal(job.jobId,'R33211')
 assert.equal(job.country,'India')
 assert.equal(job.postingDate.toISOString(),'2026-11-09T00:00:00.000Z')
 assert.equal(job.sourcePostedDateRaw,'2026-11-09')
 assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(job.sourceScopeComplete,false)
 assert.equal(job.sourceListingComplete,false)
})
test('FactSet rejects a changed actionable Vite renderer before calling its CMS',async()=>{
 await held(packets=>{packet(packets,'client-current-opening').body=packet(packets,'client-current-opening').body.replace('/api/page/','/api/other/')},/reviewed active renderer changed/)
})
test('FactSet rejects changed CMS page structure rather than discovering a dormant URL',async()=>{
 await held(packets=>editJson(packet(packets,'careers-data-current-opening'),cms=>{cms.pageType='Different Page';cms.unrelated={href:BOARD}}),/careers CMS schema changed/)
})
test('FactSet rejects disagreeing current careers CTA representations',async()=>{
 await held(packets=>editJson(packet(packets,'careers-data-current-opening'),cms=>{cms.content.sections[0].cta.link.href=BOARD+'/other'}),/current careers CTA changed/)
})
for(const suffix of ['/job/elsewhere','?tenant=other','#other'])test('FactSet refuses a non-root delegated Workday URL '+suffix,async()=>{
 await held(packets=>editJson(packet(packets,'careers-data-current-opening'),cms=>{for(const i of [0,10]){cms.content.sections[i].cta.href+=suffix;cms.content.sections[i].cta.link.href+=suffix}}),/current careers CTA changed/)
})
test('FactSet requires its current own legal identity before admitting the subsidiary',async()=>{
 await held(packets=>{const p=packet(packets,'legal-data-current-opening');p.body=p.body.replaceAll('FactSet Research Systems','Different Parent Systems')},/current legal publisher identity changed/)
})
test('FactSet rejects a native board whose current declared tenant changes',async()=>{
 await held(packets=>{const p=packet(packets,'board-html-current-opening');p.body=p.body.replace('tenant: "factset"','tenant: "unrelated"')},/native Workday board configuration changed/)
})
for(const scope of ['if-false','function','nomodule'])test('FactSet rejects an inactive native Workday configuration in '+scope,async()=>{
 await held(packets=>{
  const p=packet(packets,'board-html-current-opening')
  if(scope==='nomodule')p.body=p.body.replace('<script type="text/javascript">','<script type="text/javascript" nomodule>')
  else{
   const start=p.body.indexOf('window.workday = window.workday || {'),end=p.body.indexOf('};',start)+2
   assert.ok(start>0&&end>start)
   const assignment=p.body.slice(start,end)
   p.body=p.body.slice(0,start)+(scope==='if-false'?'if (false) { ':'function dormant() { ')+assignment+' }'+p.body.slice(end)
  }
 },/native Workday board configuration changed/)
})
for(const assignment of ['if (false) { window.workday = {}; }','window["workday"] = {};'])test('FactSet rejects an additional unreviewed native board assignment: '+assignment,async()=>{
 await held(packets=>{
  const p=packet(packets,'board-html-current-opening')
  p.body=p.body.replace('function createScriptTag (src)',assignment+'\n        function createScriptTag (src)')
 },/native Workday board configuration changed/)
})
test('FactSet excludes an unreviewed legal employer while retaining the other sixteen verified jobs',async()=>{
 const {jobs,observed}=await run(packets=>editJson(packet(packets,'detail-R32233-current-opening'),detail=>{detail.hiringOrganization.name='99999 Another Employer Private Limited'}))
 assert.equal(jobs.length,16);assert.ok(!jobs.some(j=>j.jobId==='R32233'))
 assert.ok(observed.exclusions.some(row=>row.reason==='native-employer-mismatch'&&row.nativeEmployer==='99999 Another Employer Private Limited'))
})
test('FactSet cannot accept India selection when native detail countries contradict',async()=>{
 await held(packets=>editJson(packet(packets,'detail-R32233-current-opening'),detail=>{detail.jobPostingInfo.country={descriptor:'United Kingdom',id:'29247e57dbaf46fb855b224e03170bc7'}}),/Contradictory Workday native countries/)
})
test('FactSet requires both original typed India countries for current native reconciliation',async()=>{
 await held(packets=>editJson(packet(packets,'detail-R32233-current-opening'),detail=>{delete detail.jobPostingInfo.country}),/Native work countries are missing or conflicting/)
})
test('FactSet retains an incomplete native full-criteria role as an exclusion',async()=>{
 const {jobs,observed}=await run(packets=>editJson(packet(packets,'detail-R32233-current-opening'),detail=>{detail.jobPostingInfo.jobDescription='<p>Short summary only.</p>'}))
 assert.equal(jobs.length,16);assert.ok(!jobs.some(j=>j.jobId==='R32233'))
 assert.ok(observed.exclusions.some(row=>row.reason==='native-full-description-unavailable'&&row.requisitionId==='R32233'))
})
test('FactSet discards the selected collection if a closing native legal employer changes',async()=>{
 await held(packets=>editJson(packet(packets,'detail-R32233-current-closing'),detail=>{detail.hiringOrganization.name='99999 Another Employer Private Limited'}),/Workday closing native role context changed/)
})
test('FactSet discards the selected collection if closing selected native listing context changes',async()=>{
 await held(packets=>editJson(packet(packets,'inventory-india-current-closing'),listing=>{listing.jobPostings[0].title+=' changed'}),/Workday closing selected listing context changed/)
})
test('FactSet re-reads the current CMS handoff without cache at closing',async()=>{
 await held(packets=>editJson(packet(packets,'careers-data-current-closing'),cms=>{cms.content.sections[10].cta.href=BOARD+'/changed';cms.content.sections[10].cta.link.href=BOARD+'/changed'}),/current careers CTA changed/)
})
test('FactSet does not compare unrelated CMS copy or dynamic native CSRF tokens as source context',async()=>{
 const {jobs}=await run(packets=>editJson(packet(packets,'careers-data-current-closing'),cms=>{cms.seo.description+=' Updated informational copy.'}))
 assert.equal(jobs.length,17)
})
test('FactSet declaration reads remain behind shared MIME and redirect authority checks',async()=>{
 for(const contentType of ['application/json','text/html','text/html; note=application/javascript']){
  await held(packets=>{packet(packets,'client-current-opening').contentType=contentType},/Unexpected recruitment response type/)
 }
 for(const label of ['corporate-current-opening','corporate-current-closing','board-html-current-opening','board-html-current-closing']){
  await held(packets=>{packet(packets,label).contentType='application/json; note=text/html'},/Unexpected recruitment response type/)
 }
 await held(packets=>{packet(packets,'careers-data-current-opening').finalUrl='https://unrelated.example/api/page/careers'},/Recruitment redirect changed authority/)
})
test('FactSet preserves the exact caller cancellation during publisher declaration reads',async()=>{
 const caller=new AbortController(),reason=Object.freeze(Error('caller stopped FactSet declaration')),wire=transport()
 await assert.rejects(source().run({now:()=>fixture.capturedAt,signal:caller.signal,fetchImpl:async(url,init)=>{
  const response=await wire.fetchImpl(url,init)
  if(url.endsWith('/api/page/careers'))caller.abort(reason)
  return response
 }}),error=>error===reason)
})
test('recruitment sources without the trusted config hook ignore a caller-provided publisher callback',async()=>{
 const provider=recruitmentBatchProviders().find(p=>p.source===SOURCE),wire=transport();let hookCalls=0
 await assert.rejects(createVerifiedRecruitmentScraper(provider).run({fetchImpl:wire.fetchImpl,readCurrentPublisherDeclaration:()=>{hookCalls++;return{url:BOARD}}}),error=>{
  assert.equal(error.failureKind,'coverage_gap');return true
 })
 assert.equal(hookCalls,0)
 assert.ok(wire.calls.every(call=>new URL(call.url).hostname==='www.factset.com'))
})

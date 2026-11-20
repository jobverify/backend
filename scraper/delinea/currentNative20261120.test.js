import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,createDelineaScraper} from './script.js'
import {parseCurrentBoard,parseCurrentFeed,parseCurrentRole,BOARD,FEED} from './currentNative20261120.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {appData} from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import {readJobPosting} from '../../scraper-support/native-sources/jobPostingData.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const pages=new Map(fixture.records.map(r=>[r.requestedUrl,r]))
const reply=url=>{const row=pages.get(url);assert.ok(row,'Undeclared '+url);const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:url});return response}
const body=url=>Buffer.from(pages.get(url).bodyBase64,'base64').toString()
const board=()=>parseCurrentBoard(body(BOARD)),feed=()=>parseCurrentFeed(body(FEED)),india=()=>feed().jobs.find(r=>r.location==='Home Office (India)')
const rewrite=(html,change)=>{
 const doc=readNativeDocument(html),data=appData(doc),schema=readJobPosting(html).candidate.model
 const owner=doc.nodes(n=>n.tag==='script'&&n.raw.includes('window.__appData'))[0],ld=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0]
 change(data,schema)
 return html.replace(owner.raw,'window.__appData = '+JSON.stringify(data)+';').replace(ld.raw,JSON.stringify(schema))
}
const alteredResponse=(url,text,status=200)=>{const response=new Response(text,{status,headers:pages.get(url).headers});Object.defineProperty(response,'url',{value:url});return response}
test('Delinea current own India publication survives a separately advertised localized Workday429 with honest partial scope',async()=>{
 const calls=[],jobs=await run({now:fixture.observedAt,fetchImpl:async url=>{calls.push(url);return reply(url)}})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].nativeEmployerDisplayName,'Delinea')
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].backendApplicationActivationVerified,false)
 assert.equal(jobs[0].sourceLegalEmployer,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(calls.filter(url=>url.startsWith('https://centrify.wd1.myworkdayjobs.com/')).length,1)
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,76)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.additionalChannelChecks[0].httpStatus,429)
})
test('Delinea production factory uses the same current native imported route',async()=>{
 const jobs=await createDelineaScraper({now:fixture.observedAt,fetchImpl:async url=>reply(url)}).run()
 assert.equal(jobs.length,1);assert.equal(jobs.nativeCollectionEvidence.requests,17)
 assert.equal(jobs[0].sourceClosingReconciled,true)
})
test('Delinea hidden recruitment handoffs cannot establish the mandatory current corporate binding',async()=>{
 await assert.rejects(run({now:fixture.observedAt,fetchImpl:async url=>url==='https://delinea.com/careers'
  ?alteredResponse(url,body(url).replaceAll('href="https://jobs.ashbyhq.com/delinea"','hidden href="https://jobs.ashbyhq.com/delinea"')):reply(url)}),/handoff absent/)
})
test('Delinea employer, demo, publication, application, country and authored deadline conflicts stay held',()=>{
 const job=india(),snapshot=board(),brief=snapshot.jobBoard.jobPostings.find(r=>r.id===job.id),html=body(job.jobUrl)
 for(const mutate of [d=>{d.organization.name='Another employer'},d=>{d.organization.isDemoOrg=true},d=>{d.maintenanceMode=true},
  d=>{d.posting.isListed=false},d=>{d.posting.canApply=false},d=>{d.posting.applicationDeadline='2020-01-01'},d=>{d.posting.applicationDeadline='2026-02-30'},
  (d,s)=>{s.hiringOrganization.name='Another employer'},(d,s)=>{s.jobLocation.address.addressCountry='Canada'},(d,s)=>{s.validThrough='2020-01-01'}]){
  assert.throws(()=>parseCurrentRole(rewrite(html,mutate),job,brief,snapshot,fixture.observedAt))
 }
 for(const mutate of [j=>{j.applyUrl=j.applyUrl.replace(j.id,'another-id')},j=>{j.publishedAt='2027-01-01T00:00:00Z'},
  j=>{j.countryCode='CA'},j=>{j.location='Home Office (Canada, India)'}]){
  const changed=structuredClone(job);mutate(changed);assert.throws(()=>parseCurrentRole(html,changed,brief,snapshot,fixture.observedAt))
 }
})
test('Delinea missing descriptions retain independent current native identity only as explicit partials',()=>{
 const job=structuredClone(india()),snapshot=board(),brief=snapshot.jobBoard.jobPostings.find(r=>r.id===job.id)
 job.descriptionHtml='';job.descriptionPlain=''
 const fact=parseCurrentRole(rewrite(body(job.jobUrl),(d,s)=>{d.posting.descriptionHtml='';s.description=''}),job,brief,snapshot,fixture.observedAt)
 assert.equal(fact.country,'India');assert.equal(fact.jobDescription,null);assert.equal(fact.sourceDetailComplete,false);assert.ok(fact.sourceMissingCriteria.length)
})
test('Delinea authored closure, labelled expiry/publication, workplace and employer conflicts apply across all three original criteria carriers',()=>{
 const original=india(),snapshot=board(),brief=snapshot.jobBoard.jobPostings.find(r=>r.id===original.id)
 for(const extra of ['<p>This position has been filled.</p>','<p>Closing Date: 2020-01-01</p>','<p>Application Deadline: February 30, 2026</p>',
  '<p>Date Posted: 2027-01-01</p>','<p>Location: Toronto, Canada</p>','<p>Country: Canada</p>','<p>Employer: Another Company</p>']){
  for(const carrier of ['feed','posting','schema']){
   const job=structuredClone(original),html=rewrite(body(job.jobUrl),(data,schema)=>{
    if(carrier==='posting')data.posting.descriptionHtml+=extra
    if(carrier==='schema')schema.description+=extra
   })
   if(carrier==='feed')job.descriptionHtml+=extra
   assert.throws(()=>parseCurrentRole(html,job,brief,snapshot,fixture.observedAt),undefined,carrier+' '+extra)
  }
 }
})
test('Delinea conditional future filling language and general foreign office references do not become role closures or workplaces',()=>{
 const job=india(),snapshot=board(),brief=snapshot.jobBoard.jobPostings.find(r=>r.id===job.id)
 const html=rewrite(body(job.jobUrl),data=>{data.posting.descriptionHtml+='<p>Applications will be accepted until the position is filled.</p><p>Delinea has offices in Canada.</p><p>Closing Date: January 15, 2027</p><p>Employer: Delinea</p>'})
 const fact=parseCurrentRole(html,job,brief,snapshot,fixture.observedAt)
 assert.equal(fact.country,'India');assert.equal(fact.sourceLegalEmployer,null)
})
test('Delinea authored job/publication status conflicts hold independently of employment status',()=>{
 const job=india(),snapshot=board(),brief=snapshot.jobBoard.jobPostings.find(r=>r.id===job.id),html=body(job.jobUrl)
 for(const line of ['Job Status: Draft','Publication Status: Closed','Status: Disabled','Availability: Expired'])assert.throws(()=>parseCurrentRole(rewrite(html,d=>{d.posting.descriptionHtml+='<p>'+line+'</p>'}),job,brief,snapshot,fixture.observedAt),/status|availability/i)
 assert.equal(parseCurrentRole(rewrite(html,d=>{d.posting.descriptionHtml+='<p>Job Status: Open</p><p>Employment Status: Full Time</p>'}),job,brief,snapshot,fixture.observedAt).country,'India')
})
test('Delinea current whole feed model changes cannot acquire a stable closing result',async()=>{
 let n=0
 await assert.rejects(run({now:fixture.observedAt,fetchImpl:async url=>{
  if(url!==FEED||++n===1)return reply(url)
  const model=JSON.parse(body(FEED));model.jobs[5].newAvailabilityAuthority={open:false};return alteredResponse(url,JSON.stringify(model))
 }}),/Closing whole native board\/feed/)
})
test('Delinea actually observed closing role conflicts withhold the affected record rather than returning its feed partial',async()=>{
 const url=india().jobUrl;let n=0
 const jobs=await run({now:fixture.observedAt,fetchImpl:async requested=>requested===url&&++n===2
  ?alteredResponse(requested,rewrite(body(url),d=>{d.posting.isListed=false})):reply(requested)})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.heldNativeRoles.length,1)
})
test('Delinea denial on the mandatory own Ashby channel remains terminal without closing requests',async()=>{
 const url=india().jobUrl,calls=[]
 await assert.rejects(run({now:fixture.observedAt,fetchImpl:async requested=>{calls.push(requested);return requested===url?alteredResponse(url,'Restricted',429):reply(requested)}}),/429/)
 assert.equal(calls.at(-1),url);assert.equal(calls.filter(requested=>requested===url).length,1)
})
test('Delinea ordinary production uses native fetch and preserves opaque caller cancellation',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(url);return alteredResponse(url,'Unavailable',503)}
 try{await assert.rejects(run(),/503/);assert.equal(calls.length,1)}finally{globalThis.fetch=original}
 const controller=new AbortController(),reason={source:'delinea'},task=run({signal:controller.signal,fetchImpl:()=>new Promise(()=>{})})
 setTimeout(()=>controller.abort(reason),10);await assert.rejects(task,value=>value===reason)
})

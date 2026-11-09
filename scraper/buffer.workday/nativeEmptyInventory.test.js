import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'

const opening=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/2026-10-31-official-current.json.gz',import.meta.url)))).packet
const now=()=>new Date('2026-10-31T12:40:00.000Z')
const closing=()=>({...opening,capturedAt:'2026-10-31T12:39:10.000Z',captureStartedAt:'2026-10-31T12:39:09.000Z'})
const exercise=async({first=opening,last=closing(),registered=false}={})=>{
 const calls=[]
 const fetchPage=async(url,options)=>{calls.push({url,signal:options?.signal});return calls.length===1?first:last}
 const jobs=registered?await createCatalogScraper(getScraperCatalog().find(p=>p.source==='buffer')).run({fetchPage,now}):await run({fetchPage,now})
 return {jobs,calls,evidence:readInventoryEvidence(jobs)}
}
const change=body=>({...opening,body,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')})
const replaceEmpty=value=>change(opening.body.replace('<p>There are currently no open roles.</p>',value))

test('captured employer-wide explicit zero plus a separately timed matching closing read proves zero without restamping the opening',async()=>{
 const {jobs,calls,evidence}=await exercise()
 assert.equal(calls.length,2)
 assert.ok(calls.every(c=>c.url==='https://buffer.com/journey'))
 assert.equal(jobs.length,0)
 assert.equal(evidence.status,'verified-empty')
 assert.equal(evidence.firstParty,true)
 assert.equal(evidence.listingComplete,true)
 assert.equal(evidence.pagesFetched,2)
 assert.equal(evidence.reportedTotal,0)
 assert.equal(evidence.indiaFacetCount,0)
 assert.equal(evidence.verifiedAt,opening.capturedAt)
 assert.equal(jobs.nativeCollectionEvidence.opening.body,opening.body)
 assert.equal(jobs.nativeCollectionEvidence.opening.sha256,opening.sha256)
 assert.equal(jobs.nativeCollectionEvidence.nativeJobPostingCount,0)
 assert.equal(jobs.nativeCollectionEvidence.closing.capturedAt,'2026-10-31T12:39:10.000Z')
})

test('the registered provider invokes the current module and preserves runtime verified empty evidence',async()=>{
 const {jobs,calls,evidence}=await exercise({registered:true})
 assert.equal(calls.length,2)
 assert.equal(jobs.length,0)
 assert.equal(evidence.status,'verified-empty')
 assert.equal(evidence.verifiedAt,opening.capturedAt)
})

test('effective and local metadata describe the current empty-only native collector without static verified counts',async()=>{
 const local=(await import('./catalog.js')).default,effective=getScraperCatalog().find(p=>p.source==='buffer')
 for(const provider of [local,effective]){
  assert.equal(provider.atsPlatform,'official-company-careers')
  assert.equal(provider.backfillMode,'native-empty-inventory-only')
  assert.equal(provider.companyCareerPage,'https://buffer.com/journey')
  assert.equal(provider.zeroResultPolicy,'evidence-required')
  assert.equal(provider.verifiedOn,null)
  assert.equal(provider.verifiedPublicJobCount,null)
  assert.equal(provider.verifiedIndiaJobCount,null)
  assert.match(provider.modulePath.replaceAll('\\','/'),/\/buffer\.workday\/script\.js$/)
 }
})

test('a visible region-only empty statement without the all-openings contract remains partial with unknown company totals',async()=>{
 const first=change(opening.body.replace('We post all open roles here, and only accept job applications through the forms on this page.','Explore life at Buffer.'))
 const {jobs,calls,evidence}=await exercise({first})
 assert.equal(calls.length,1)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.match(evidence.reason,/scope/)
 assert.equal(readSourceObservationEvidence(jobs,'buffer').observedVacancyCount,0)
})

test('untimed, stale or future injected captures cannot mint fresh zero and do not trigger pointless closing reads',async()=>{
 for(const capturedAt of [undefined,'2026-10-28T12:38:56.027Z','2026-11-01T12:38:56.027Z']){
  const {calls,evidence}=await exercise({first:{...opening,capturedAt}})
  assert.equal(calls.length,1)
  assert.equal(evidence.status,'coverage-gap')
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.notEqual(evidence.verifiedAt,now().toISOString())
 }
})

test('reused or untimed closing evidence cannot claim an independently completed current zero check',async()=>{
 for(const last of [opening,{...opening,capturedAt:undefined},{...closing(),captureStartedAt:'2026-10-31T12:38:00.000Z'}]){
  const {calls,evidence}=await exercise({last})
  assert.equal(calls.length,2)
  assert.equal(evidence.status,'coverage-gap')
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
 }
})

test('a vanished empty statement or future unsupported positive role schema fails closed',async()=>{
 for(const first of [replaceEmpty('<p>New openings coming soon.</p>'),replaceEmpty('<a href="/journey/controlled-new-role">Controlled new role</a>')]){
  await assert.rejects(exercise({first}),/empty|unsupported|role/i)
 }
})

test('current-format native flight role data must agree with the visible zero',async()=>{
 for(const body of [opening.body.replace('jobPostingList\\\":[]','jobPostingList\\\":[{\\\"id\\\":\\\"controlled\\\"}]'),opening.body.replace('jobPostingList\\\":[]','jobPostingList\\\":[],\\\"jobPostingList\\\":[]')]){
  assert.notEqual(body,opening.body)
  await assert.rejects(exercise({first:change(body)}),/native.*role|jobPostingList|ambiguous/i)
 }
})

test('hidden, inert, commented, opacity-zero and author-CSS-hidden empty copies cannot supply visible zero',async()=>{
 for(const value of ['<p hidden>There are currently no open roles.</p>','<p aria-hidden="true">There are currently no open roles.</p>','<p style="opacity:0">There are currently no open roles.</p>','<template><p>There are currently no open roles.</p></template>','<!--<p>There are currently no open roles.</p>-->','<style>#open-roles p:first-of-type {display:none}</style><p>There are currently no open roles.</p>']){
  await assert.rejects(exercise({first:replaceEmpty(value)}),/empty|visible|scope/i)
 }
})

test('canonical, employer title, visible identity and ambiguous section controls are required',async()=>{
 for(const body of [opening.body.replace('rel="canonical" href="https://buffer.com/journey"','rel="canonical" href="https://example.org/journey"'),opening.body.replace('<title>Join the Buffer journey - Jobs at Buffer</title>','<title>Other employer careers</title>'),opening.body.replace('>Join the Buffer Journey</h1>','>Another employer</h1>'),opening.body.replace('</main>','<section id="open-roles" hidden></section></main>')]){
  assert.notEqual(body,opening.body)
  await assert.rejects(exercise({first:change(body)}),/identity|canonical|ambiguous|section/i)
 }
})

test('active additional hiring links, job forms, roles or Ashby frames contradict the zero without being followed',async()=>{
 for(const fragment of ['<a href="https://jobs.ashbyhq.com/buffer/current">Apply for a role</a>','<iframe src="https://jobs.ashbyhq.com/buffer/current"></iframe>','<form action="/apply"><input name="resume"/><button>Apply now</button></form>','<p>We are currently hiring a controlled engineer.</p>','<div>We are currently hiring a controlled engineer.</div>',"<div>We're hiring a controlled engineer.</div>"]){
  const body=opening.body.replace('</main>',fragment+'</main>')
  await assert.rejects(exercise({first:change(body)}),/hiring|contradict|form|frame|role/i)
 }
})

test('an explicit visible Now hiring section contradicts company zero while its hidden equivalent remains inert',async()=>{
 for(const hidden of [false,true]){
  const body=opening.body.replace('</main>','<section'+(hidden?' hidden':'')+'><h2>Now hiring</h2><p>Senior software engineer</p></section></main>')
  assert.notEqual(body,opening.body)
  const first=change(body),last={...closing(),...first,capturedAt:closing().capturedAt,captureStartedAt:closing().captureStartedAt}
  if(!hidden)await assert.rejects(exercise({first,last}),/hiring|contradict|role/i)
  else assert.equal((await exercise({first,last})).evidence.status,'verified-empty')
 }
})

test('only explicit own native ISO clock data can authorize a fresh complete empty check without invoking accessors',async()=>{
 let getterReads=0
 const inheritedFirst=Object.assign(Object.create({capturedAt:opening.capturedAt}),opening)
 delete inheritedFirst.capturedAt
 const getterFirst={...opening}
 Object.defineProperty(getterFirst,'capturedAt',{enumerable:true,get(){getterReads++;return opening.capturedAt}})
 const inheritedLast=Object.assign(Object.create({capturedAt:closing().capturedAt}),closing())
 delete inheritedLast.capturedAt
 for(const options of [{first:inheritedFirst},{first:getterFirst},{first:{...opening,capturedAt:+new Date(opening.capturedAt)}},{last:inheritedLast}]){
  const {evidence}=await exercise(options)
  assert.equal(evidence.status,'coverage-gap')
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
 }
 assert.equal(getterReads,0)
})

test('permanently inactive historical hiring markup cannot become a positive role or override the bound current empty contract',async()=>{
 const fragment='<!--<a href="https://jobs.ashbyhq.com/buffer/old">Apply now</a>--><template><iframe src="https://jobs.ashbyhq.com/buffer/old"></iframe></template><div hidden><form action="/apply"><button>Apply now</button></form></div>'
 const first=change(opening.body.replace('</main>',fragment+'</main>'))
 const last={...closing(),...change(first.body),capturedAt:closing().capturedAt,captureStartedAt:closing().captureStartedAt}
 const {jobs,evidence}=await exercise({first,last})
 assert.equal(jobs.length,0)
 assert.equal(evidence.status,'verified-empty')
})

test('a changed closing inventory fails rather than preserving the opening empty result',async()=>{
 await assert.rejects(exercise({last:{...closing(),...change(opening.body.replace('<p>There are currently no open roles.</p>','<p>Applications are now open.</p>')),capturedAt:closing().capturedAt,captureStartedAt:closing().captureStartedAt}}),/empty|changed|closing|role/i)
})

test('registered partial evidence retains zero observed rows without company zero authority',async()=>{
 const {jobs,evidence}=await exercise({first:{...opening,capturedAt:undefined},registered:true})
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.deepEqual(readSourceObservationEvidence(jobs,'buffer'),{source:'buffer',recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
})

test('an added regional limitation cannot turn the employer sentence into a whole-company zero contract',async()=>{
 const first=change(opening.body.replace('We post all open roles here,','This page covers only one region. We post all open roles here,'))
 const {calls,evidence}=await exercise({first,last:{...closing(),...first,capturedAt:closing().capturedAt,captureStartedAt:closing().captureStartedAt}})
 assert.equal(calls.length,1)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
})

test('the oldest opening clock must remain fresh when the closing read actually completes',async()=>{
 const openingTime=+new Date(opening.capturedAt),limit=48*3600000
 let clockReads=0,pageReads=0
 const jobs=await run({now:()=>new Date(openingTime+limit+(clockReads++?1000:-1000)),fetchPage:async()=>++pageReads===1?opening:{...opening,captureStartedAt:new Date(openingTime+limit-500).toISOString(),capturedAt:new Date(openingTime+limit).toISOString()}})
 const evidence=readInventoryEvidence(jobs)
 assert.equal(pageReads,2)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.verifiedAt,opening.capturedAt)
})

test('missing current native client corroboration remains a timed visible-zero observation with unknown totals',async()=>{
 const first=change(opening.body.replace('jobPostingList\\\":[]','unreviewedRoleList\\\":[]'))
 assert.notEqual(first.body,opening.body)
 const {calls,evidence}=await exercise({first})
 assert.equal(calls.length,1)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
})

test('both actual independently captured public pages replay through the registered provider with their original oldest clock',async()=>{
 const last=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/2026-10-31-official-closing.json.gz',import.meta.url)))).packet
 assert.equal(createHash('sha256').update(last.body).digest('hex'),last.sha256)
 assert.ok(+new Date(last.captureStartedAt)>+new Date(opening.capturedAt))
 const pages=[opening,last],seen=[]
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='buffer')).run({now:()=>new Date(+new Date(last.capturedAt)+1),fetchPage:async url=>{seen.push(url);assert.ok(pages.length);return pages.shift()}})
 const evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0)
 assert.deepEqual(seen,['https://buffer.com/journey','https://buffer.com/journey'])
 assert.equal(evidence.status,'verified-empty')
 assert.equal(evidence.reportedTotal,0)
 assert.equal(evidence.indiaFacetCount,0)
 assert.equal(evidence.verifiedAt,opening.capturedAt)
})

test('duplicate conflicting native page identity fields cannot be erased by JSON last-key selection',async()=>{
 const body=opening.body.replace('pageClass\\\":\\\"/journey\\\"','pageClass\\\":\\\"/other\\\",\\\"pageClass\\\":\\\"/journey\\\"')
 assert.notEqual(body,opening.body)
 await assert.rejects(exercise({first:change(body)}),/ambiguous|duplicate|binding|identity/i)
})

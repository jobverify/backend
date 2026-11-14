import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const source='nexturn',expected=36
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261114.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const provider=getScraperCatalog().find(row=>row.source===source)
const scraper=()=>createCatalogScraper(provider)
function replay(change=(_url,row)=>row){
 const requests=[],counts=new Map()
 const read=async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted();const count=(counts.get(url)||0)+1;counts.set(url,count)
  const matches=fixture.responses.filter(row=>row.url===url),original=matches[Math.min(count-1,matches.length-1)]
  assert.ok(original,'Undeclared public read '+url);assert.equal(init.method||'GET','GET')
  requests.push(url);const row=await change(url,structuredClone(original),count,init)
  const response=new Response(row.body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl??row.url});return response
 }
 return {read,requests}
}

test('nexturn current registered native collector recovers full original explicit India roles with scope held',async t=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 const transport=replay();t.mock.method(globalThis,'fetch',transport.read)
 const jobs=await scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt})
 assert.equal(jobs.length,expected)
 assert.equal(new Set(jobs.map(job=>job.sourceNativeJobId)).size,36)
 assert.equal(jobs.some(job=>/servicenow-product-manager|sr-software-engineer-plm-platform/.test(job.sourceUrl)),false)
 assert.ok(jobs.every(job=>job.country==='India'&&job.source===source&&job.sourceDetailComplete===true&&job.sourceClosingReconciled===true&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>job.sourceDescription.length>300&&job.sourceDescriptionHTML.length>300))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(assessSoftFailureAcquisition(provider,jobs).runnerOutcome.success,true)
})

const module=await import('./script.js')
const {readNexTurnListing,readNexTurnDetail,CURRENT_CANONICAL_ORIGIN}=await import('./currentNative.js')
const spec={careersSignal:module.hasOfficialCareersSignal,cards:module.extractJobCards,detailSignal:module.hasOfficialJobDetailSignal,detail:module.extractJobDetail}
const saved=url=>fixture.responses.find(row=>row.url===url).body
const careerURL='https://nexturn.com/careers/',listing=()=>readNexTurnListing(spec,saved(careerURL)),first=()=>listing()[0]
for(const [name,edit]of [
 ['unreviewed cloud hostname',s=>s.replaceAll(CURRENT_CANONICAL_ORIGIN,'https://other.elb.amazonaws.com')],
 ['cloud canonical path disagreement',s=>s.replace(CURRENT_CANONICAL_ORIGIN+'/job/sr-frontend-engineer/',CURRENT_CANONICAL_ORIGIN+'/job/another-role/')],
 ['another title',s=>s.replace('<h1 class="section-title">Sr. Frontend Engineer','<h1 class="section-title">Another title')],
 ['missing requirements',s=>s.replace('Requirements:','Removed section:')],
 ['missing qualification',s=>s.replace('Qualifications:','Removed section:')],
 ['country conflict',s=>s.replace('India, Hyderabad<h3>','India, Singapore<h3>')],
 ['hidden original criterion',s=>s.replace('Requirements:</h2>','Requirements:</h2><p hidden>Mandatory original condition</p>')],
 ['executable original criterion',s=>s.replace('Requirements:</h2>','Requirements:</h2><script>window.criteria=true</script>')],
 ['criterion after application boundary',s=>s.replace('class="apply-btn-container text-left">','class="apply-btn-container text-left"><p>Mandatory after-control criterion</p>')],
 ['closed native notice',s=>s.replace('Requirements:</h2>','Requirements:</h2><p>This job is closed.</p>')],
 ['missing original native ID',s=>s.replace('rel=shortlink','rel=unreviewed')],
])test('NexTurn rejects '+name,()=>{const row=first(),original=saved(row.sourceUrl),changed=edit(original);assert.notEqual(changed,original);assert.throws(()=>readNexTurnDetail(spec,changed,row),/native|criteria/i)})
test('NexTurn retains every native requirements, qualification and description item',()=>{
 const row=first(),result=readNexTurnDetail(spec,saved(row.sourceUrl),row)
 assert.match(result.criteria.sourceDescription,/Model Context Protocol/);assert.match(result.criteria.sourceDescription,/equivalent practical experience/)
 assert.match(result.criteria.sourceDescription,/Work with backend, design, and product teams/)
 assert.equal(result.nativeId,'3975');assert.equal(result.detail.location,'India, Hyderabad')
})
test('NexTurn rejects duplicate canonical listing rows',()=>{const original=saved(careerURL),changed=original.replace('https://nexturn.com/job/sr-backend-engineer/','https://nexturn.com/job/sr-frontend-engineer/');assert.throws(()=>readNexTurnListing(spec,changed),/duplicated/)})
test('NexTurn original full criteria drift at closing withholds the exact changed role',async()=>{
 const url=first().sourceUrl,transport=replay((target,row,count)=>{if(target===url&&count===2)row.body=row.body.replace('Requirements:</h2>','Requirements:</h2><p>Additional mandatory native qualification</p>');return row})
 const jobs=await scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt})
 assert.equal(jobs.length,35);assert.equal(jobs.some(job=>job.sourceUrl===url),false)
 assert.ok(jobs.nativeCollectionEvidence.holds.some(h=>h.url===url&&h.reason==='native-full-original-criteria-changed-at-closing'))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const options of [{maxJobs:0},{fetchText:async()=>'<p>Body only</p>'},{fetchJson:async()=>({})}])test('nexturn rejects unsupported extraction override '+Object.keys(options)[0]+' before I/O',async()=>{
 let calls=0
 await assert.rejects(scraper().run({...options,fetchImpl:async()=>{calls++;throw Error('Unexpected I/O')}}))
 assert.equal(calls,0)
})
test('nexturn preserves the opaque caller abort before acquisition',async()=>{
 const reason={caller:'stop'},controller=new AbortController();controller.abort(reason);let calls=0
 await assert.rejects(scraper().run({signal:controller.signal,fetchImpl:async()=>{calls++;throw Error('Unexpected I/O')}}),error=>error===reason)
 assert.equal(calls,0)
})
test('nexturn propagates cancellation and cancels a late original response',async()=>{
 const reason={caller:'pending-stop'},controller=new AbortController();let release,cancels=0,calls=0
 const pending=scraper().run({signal:controller.signal,fetchImpl:async()=>{calls++;return new Promise(resolve=>{release=resolve})}})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason);await assert.rejects(pending,error=>error===reason)
 const response=new Response(new ReadableStream({cancel(){cancels++}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:fixture.responses[0].url});release(response)
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))
 assert.equal(calls,1);assert.equal(cancels,1)
})
test('nexturn retains existing bounded request deadline',async()=>{
 await assert.rejects(scraper().run({requestTimeoutMs:10,fetchImpl:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
})
for(const status of [403,404])test('nexturn preserves public HTTP '+status+' and exact original URL',async()=>{
 const transport=replay((_url,row)=>({...row,status}));await assert.rejects(scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt}),error=>error.status===status&&error.abortRetries===true)
 assert.equal(transport.requests.length,1)
})

test('NexTurn holds an entirely unqualified location inventory without certifying zero',async()=>{
 const transport=replay((url,row)=>{if(url===careerURL)row.body=row.body.replace(/(<p\b[^>]*class=["']?job-subtitle["']?[^>]*>)[\s\S]*?<\/p>/g,'$1Unqualified local worksite</p>');return row})
 const jobs=await scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(assessSoftFailureAcquisition(provider,jobs).runnerOutcome.success,false)
 assert.equal(transport.requests.some(url=>url.includes('/job/')),false)
})
test('NexTurn rejects repeated original WordPress IDs before publishing any source result',async()=>{
 const transport=replay((url,row)=>{if(url==='https://nexturn.com/job/sr-backend-engineer/'){const original=sha(row.body);row.body=row.body.replace(/(href=["']?https:\/\/nexturn\.com\/\?p=)\d+/g,(_match,prefix)=>prefix+'3975');assert.notEqual(sha(row.body),original,'Expected actual short-link mutation')}return row})
 await assert.rejects(scraper().run({fetchImpl:transport.read,now:()=>fixture.capturedAt}),/Duplicate original native WordPress role ID/)
 assert.equal(transport.requests.length,4)
})


const wrapRoleCriteria=html=>html.replace('<h1 class="section-title">','<template><h1 class="section-title">').replace('<div class="apply-btn-container text-left">','</template><div class="apply-btn-container text-left">')
for(const [name,edit]of [
 ['hidden document body',s=>s.replace(/<body\b/,'<body hidden')],
 ['inert document body',s=>s.replace(/<body\b/,'<body inert')],
 ['CSS hidden role ancestor',s=>s.replace('<h1 class="section-title">','<div style="opacity:0"><h1 class="section-title">').replace('<div class="apply-btn-container text-left">','</div><div class="apply-btn-container text-left">')],
 ['template-owned original criteria',wrapRoleCriteria],
])test('NexTurn rejects ancestor '+name,()=>{const row=first(),original=saved(row.sourceUrl),changed=edit(original);assert.notEqual(changed,original);assert.throws(()=>readNexTurnDetail(spec,changed,row),/native|criteria/i)})
for(const [name,edit]of [
 ['hidden document body',s=>s.replace(/<body\b/,'<body hidden')],
 ['inert document body',s=>s.replace(/<body\b/,'<body inert')],
 ['template-owned native rows',s=>s.replace(/<body\b([^>]*)>/,'<body$1><template>').replace('</body>','</template></body>')],
 ['CSS hidden native rows',s=>s.replace(/<body\b/,'<body style="opacity:0"')],
])test('NexTurn rejects listing ancestor '+name,()=>{const original=saved(careerURL),changed=edit(original);assert.notEqual(changed,original);assert.throws(()=>readNexTurnListing(spec,changed),/native|listing/i)})

for(const rule of ['ul { display:none !important; }','.innersec-white-medium { display:none !important; }'])test('NexTurn rejects complete original criteria hidden by document CSS: '+rule,()=>{
 const row=first(),original=saved(row.sourceUrl),changed=original.replace('</head>','<style>'+rule+'</style></head>')
 assert.notEqual(changed,original);assert.throws(()=>readNexTurnDetail(spec,changed,row),/native|criteria/i)
})

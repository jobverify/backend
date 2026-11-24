import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

// The publisher packets are the November20 originals. The unmodified native
// cohort is explicitly historical; only the separate registered capture can
// establish current native observations.
const old=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const deployment=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-corporate-20261120.json.gz',import.meta.url))))
const packets=new Map([...old.packets,...deployment.packets].map(p=>[p.url,p]))
const corporate='https://www.vistex.com/careers/careers-in-india/'
const chunk='https://www.vistex.com/_next/static/chunks/7511-74f3ae4544bc5a7e.js'
const priorChunk=old.packets.find(p=>p.url.endsWith('/7511-04cfcc1e0f93f1b1.js'))
const webpack='https://www.vistex.com/_next/static/chunks/webpack-a1e0400821380e5c.js'
const priorWebpack=old.packets.find(p=>p.url===webpack)
const priorCorporate=old.packets.find(p=>p.url===corporate)
const target='a97cfec6-4efe-45a3-93f6-29f9fe104545'
const role='https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/OpportunityDetail?opportunityId='+target
const options={now:'2026-11-21T00:00:00.000Z',requestIntervalMs:0}
const changed=(text,from,to)=>{assert.ok(text.includes(from),'actual retained mutation owner');return text.replaceAll(from,to)}
function transport(edit=()=>{}){
 const calls=[],counts=new Map()
 return{calls,fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const original=packets.get(url);assert.ok(original,'only exact declared retained replay packets '+url)
  const count=(counts.get(url)??0)+1;counts.set(url,count);calls.push({url,count})
  const p={...original,headers:{...original.headers},html:Buffer.from(original.bodyBase64,'base64').toString('utf8')}
  edit(p,{url,count});return Object.defineProperty(new Response(p.html,{status:p.status,headers:p.headers}),'url',{value:p.url})
 }}
}

test('current original corporate deployment admits the unchanged historical native control cohort with all holds',async()=>{
 const io=transport(),jobs=await run({...options,fetchImpl:io.fetchImpl})
 assert.equal(jobs.length,8);assert.equal(jobs.sourceAudit.opening.rows.length,20);assert.equal(jobs.sourceAudit.closing.rows.length,20)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false&&j.sourceRenderedApplicationQualified===false))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const job=jobs.find(j=>j.nativeOpportunityId===target);assert.match(job.jobDescription,/Bachelors or better in Computer Engineering or related field/);assert.match(job.jobDescription,/10 years: SAP Functional Consulting/)
 assert.equal(io.calls.filter(c=>c.url===chunk).length,2)
 assert.ok(io.calls.every(c=>!/LoadSearchResults|GetFilters|OpportunityApply|Login/.test(c.url)))
})

test('current corporate deployment rejects unknown, mixed and altered whole clients and styles',async()=>{
 for(const kind of ['unknown-build','mixed-declaration','mixed-chunk-body','mixed-webpack-body','changed-manifest','changed-css']){
  const io=transport((p,{url})=>{
   if(kind==='unknown-build'&&url===corporate)p.html=changed(p.html,'736d346dd031f29f10c6e1259283809c87d17ece','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
   if(kind==='mixed-declaration'&&url===corporate)p.html=changed(p.html,'7511-74f3ae4544bc5a7e.js','7511-04cfcc1e0f93f1b1.js')
   if(kind==='mixed-chunk-body'&&url===chunk)p.html=Buffer.from(priorChunk.bodyBase64,'base64').toString('utf8')
   if(kind==='mixed-webpack-body'&&url===webpack)p.html=Buffer.from(priorWebpack.bodyBase64,'base64').toString('utf8')
   if(kind==='changed-manifest'&&url.endsWith('/_buildManifest.js'))p.html+=';unreviewedPublisherOverride()'
   if(kind==='changed-css'&&url.endsWith('/7d9031c91ac6b3b2.css'))p.html+='\nbody{display:none}'
  })
  await assert.rejects(run({...options,fetchImpl:io.fetchImpl}),/Vistex current native:/,kind)
 }
})

test('retained old corporate contract cannot consume the new deployment webpack body',async()=>{
 const io=transport((p,{url})=>{if(url===corporate)p.html=Buffer.from(priorCorporate.bodyBase64,'base64').toString('utf8')})
 await assert.rejects(run({...options,fetchImpl:io.fetchImpl}),/Vistex current native: complete authoritative declared client\/style bytes changed/)
})

test('current corporate deployment retains country, all criteria and closing reconciliation controls',async()=>{
 for(const kind of ['country','new-criterion','closing-criterion','closing-publisher','closing-deployment']){
  const io=transport((p,{url,count})=>{
   if(url===role&&kind==='country')p.html=changed(p.html,'"Name":"India","Code":"IND"','"Name":"United States","Code":"USA"')
   if(url===role&&kind==='new-criterion')p.html=changed(p.html,'"BehaviorCriteria":[]','"BehaviorCriteria":[{"Description":"Applicants must hold a cryptography doctorate."}]')
   if(url===role&&kind==='closing-criterion'&&count===2)p.html=changed(p.html,'Excellent client-facing and interpersonal skills','Applicants must hold a cryptography doctorate.')
   if(url===corporate&&kind==='closing-publisher'&&count===2)p.html=changed(p.html,'<body','<body data-required-qualification="New publisher requirement"')
   if(kind==='closing-deployment'&&count===2){
    if(url===corporate)p.html=Buffer.from(priorCorporate.bodyBase64,'base64').toString('utf8')
    if(url===webpack)p.html=Buffer.from(priorWebpack.bodyBase64,'base64').toString('utf8')
   }
  })
  await assert.rejects(run({...options,fetchImpl:io.fetchImpl}),/Vistex current native:/,kind)
 }
})

test('current corporate deployment preserves opaque caller cancellation before any declared read',async()=>{
 const reason=Object.freeze({kind:'opaque-current-corporate-abort'}),controller=new AbortController();controller.abort(reason)
 await assert.rejects(run({...options,signal:controller.signal,fetchImpl:async()=>assert.fail('no reads after cancellation')}),e=>e===reason)
})

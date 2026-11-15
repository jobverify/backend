import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-native-20261115.json.gz',import.meta.url))))
export async function replayCurrent(t,{change,options={}}={}){
 const counts=new Map(),requests=[]
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const method=init.method??'GET',body=init.body??null
  const found=fixture.packets.find(p=>p.url===String(url)&&p.method===method&&p.requestBody===body)
  assert.ok(found,'Uncaptured original native request '+method+' '+url+' '+body)
  const packet=structuredClone(found),pass=(counts.get(packet.url)??0)+1
  counts.set(packet.url,pass)
  packet.body=Buffer.from(packet.bodyBase64,'base64').toString()
  requests.push({url:packet.url,method,body})
  change?.(packet,{pass,number:requests.length})
  const response=new Response(packet.body,{status:packet.status,headers:{'content-type':packet.headers['content-type']??'text/html'}})
  Object.defineProperty(response,'url',{value:packet.finalURL})
  return response
 })
 return {jobs:await run({now:'2026-11-15T10:00:00.000Z',...options}),requests,counts}
}

test('current fixture retains genuine native bytes and27 distinct India records',()=>{
 assert.equal(fixture.packets.length,38)
 for(const packet of fixture.packets)assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),packet.bodySHA256)
 const listed=fixture.packets.filter(p=>p.method==='POST').map(p=>JSON.parse(Buffer.from(p.bodyBase64,'base64'))).flatMap(p=>p.jobSearchResult??[])
 assert.equal(listed.length,27);assert.equal(new Set(listed.map(p=>p.response.id)).size,27)
})
test('current advertised build publishes full typed-India own roles and retains pooling record with partial scope',async t=>{
 const {jobs,counts}=await replayCurrent(t)
 assert.equal(jobs.length,26)
 assert.equal(jobs.find(job=>job.jobId==='171442')?.location,'Sricity, Andhra Pradesh, India')
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===true&&job.jobDescription.length>1000&&job.nativeCompanyBrand==='Colgate-Palmolive'))
 assert.equal(jobs.find(job=>job.jobId==='177182')?.postedAt,'2026-11-13T00:00:00.000Z')
 assert.equal(jobs.find(job=>job.jobId==='167261')?.postedAt,'2025-05-23T00:00:00.000Z')
 assert.equal(jobs.nativeCollectionEvidence.observations.length,27)
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRecords.length,1)
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRecords[0].uid,'177064')
 assert.equal(jobs.nativeCollectionEvidence.otherPublicDetailsClosingRechecked,true)
 assert.ok(jobs.every(job=>counts.get(job.sourceUrl)===2))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false))
})
const role=packet=>packet.url.includes('/177182-en_US')
const atOwner=(body,notice)=>body.replace(/(<div\b[^>]*class="jobDisplayShell"[^>]*>)/, '$1'+notice)
for(const notice of ['This job is not available.','This position is currently unavailable.','This position has been filled.'])for(const closingOnly of [false,true])test('current visible role-owner closure rejects '+notice+(closingOnly?' at closing only':''),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(packet,{pass})=>{if(role(packet)&&(!closingOnly||pass===2)){const before=packet.body;packet.body=atOwner(packet.body,'<p>'+notice+'</p>');assert.notEqual(packet.body,before)}}}),/closed|unavailable|availability/i)
})
for(const closingOnly of [false,true])test('active current notice outside the own schema owner still rejects'+(closingOnly?' at closing only':''),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(packet,{pass})=>{if(role(packet)&&(!closingOnly||pass===2))packet.body=packet.body.replace(/(<body\b[^>]*>)/,'$1<p>This job is not available.</p>')}}),/closed|unavailable|availability/i)
})
for(const closingOnly of [false,true])test('explicit Applications are closed notice rejects the current full body'+(closingOnly?' at closing only':''),async t=>{
 await assert.rejects(()=>replayCurrent(t,{change:(packet,{pass})=>{if(role(packet)&&(!closingOnly||pass===2))packet.body=packet.body.replace(/(<body\b[^>]*>)/,'$1<p>Applications are closed.</p>')}}),/closed|unavailable|availability/i)
})
test('inactive application-closed template preserves full current role',async t=>{
 const {jobs}=await replayCurrent(t,{change:packet=>{if(role(packet))packet.body=atOwner(packet.body,'<template><p>Applications are closed.</p></template>')}})
 assert.equal(jobs.length,26)
})
for(const [name,change]of[
 ['corporate handoff hidden by stylesheet',packet=>{if(packet.url.includes('colgatepalmolive.co.in'))packet.body=packet.body.replace('</head>','<style>a{display:none!important}</style></head>')}],
 ['whole role body hidden by stylesheet',packet=>{if(role(packet))packet.body=packet.body.replace('</head>','<style>body{display:none!important}</style></head>')}],
 ['full own criteria hidden by stylesheet',packet=>{if(role(packet))packet.body=packet.body.replace('</head>','<style>[itemprop="description"]{display:none!important}</style></head>')}],
 ['disabled own application controls',packet=>{if(role(packet))packet.body=packet.body.replaceAll('href="/talentcommunity/apply/177182/?locale=en_US"','aria-disabled="true" href="/talentcommunity/apply/177182/?locale=en_US"')}],
 ['inert antiClickjack controller',packet=>{if(role(packet))packet.body=packet.body.replace('type="text/javascript" id="antiClickJackScript"','type="application/json" id="antiClickJackScript"')}],
 ['empty-src authoritative bootstrap',packet=>{if(packet.url.endsWith('/search/'))packet.body=packet.body.replace(/<script type="application\/javascript">(\s*\/\/<!\[CDATA\[\s*var session =)/,'<script src="" type="application/javascript">$1')}],
 ['inline late employer mutation',packet=>{if(packet.url.endsWith('/search/'))packet.body=packet.body.replace('</body>',"<script>globalThis['resultStyles'].companyId='other';</script></body>")}],
 ['decoded duplicate native company field',packet=>{if(packet.method==='POST'&&packet.body.includes('"jobSearchResult"'))packet.body=packet.body.replace('"filter5":["Colgate-Palmolive"]','"filter5":["Colgate-Palmolive"],"filter\\u0035":["Colgate-Palmolive"]')}],
 ['decoded duplicate native total field',packet=>{if(packet.method==='POST'&&packet.body.includes('"jobSearchResult"'))packet.body=packet.body.replace('"totalJobs":27','"totalJobs":27,"total\\u004aobs":27')}],
 ['wrong current complete client body',packet=>{if(packet.url.includes('main.fb2b337c.js'))packet.body+='/*unreviewed*/'}],
 ['duplicate raw vacancy identity',packet=>{if(packet.method==='POST'&&packet.body.includes('"jobSearchResult"')){const d=JSON.parse(packet.body);d.jobSearchResult[1]=d.jobSearchResult[0];packet.body=JSON.stringify(d)}}],
 ['native foreign country contradicts India query',packet=>{if(packet.method==='POST'&&packet.body.includes('"jobSearchResult"')){const d=JSON.parse(packet.body);d.jobSearchResult[0].response.jobLocationShort=['Mumbai, MH, USA, '];packet.body=JSON.stringify(d)}}],
 ['native wrong company brand',packet=>{if(packet.method==='POST'&&packet.body.includes('"jobSearchResult"')){const d=JSON.parse(packet.body);d.jobSearchResult[0].response.filter5=['Other employer'];packet.body=JSON.stringify(d)}}],
 ['new contradictory typed country field',packet=>{if(packet.method==='POST'&&packet.body.includes('"jobSearchResult"')){const d=JSON.parse(packet.body),row=d.jobSearchResult.find(entry=>entry.response.id==='177182');if(row)row.response.filter1=['United States'];packet.body=JSON.stringify(d)}}],
 ['new hidden criteria inside the own main description',packet=>{if(role(packet)){const before=packet.body;packet.body=packet.body.replace('Brief introduction - Role Summary/Purpose:','<span hidden>Mandatory native role criterion is unpublished.</span>Brief introduction - Role Summary/Purpose:');assert.notEqual(packet.body,before)}}],
 ['new own typed country contradiction',packet=>{if(role(packet))packet.body=atOwner(packet.body,'<span itemprop="addressCountry">US</span>')}],
 ['new own explicit employer contradiction',packet=>{if(role(packet))packet.body=atOwner(packet.body,'<p>Hiring Organization: Unrelated Employer</p>')}],
 ['antiClickjack controller executes before its mask exists',packet=>{if(role(packet)){const controller=packet.body.match(/<script type="text\/javascript" id="antiClickJackScript">[\s\S]*?<\/script>/)[0];packet.body=packet.body.replace(controller,'').replace('<style id="antiClickjack"',controller+'<style id="antiClickjack"')}}],
 ['initial search is served as inert JSON MIME',(packet,{pass})=>{if(packet.url.endsWith('/search/')&&pass===1)packet.headers['content-type']='application/json'}],
 ['initial corporate handoff is served as inert JSON MIME',(packet,{pass})=>{if(packet.url.includes('colgatepalmolive.co.in')&&pass===1)packet.headers['content-type']='application/json'}],
 ['own native apply URL belongs to another role',packet=>{if(role(packet))packet.body=packet.body.replaceAll('/talentcommunity/apply/177182/','/talentcommunity/apply/177190/')}],
])test('current native qualification rejects '+name,async t=>{await assert.rejects(()=>replayCurrent(t,{change}))})
for(const carrier of ['<p hidden>This job is not available.</p>','<template><p>This position has been filled.</p></template>','<p style="display:none">This position is currently unavailable.</p>'])test('inactive role-owner notice preserves genuine current positives '+carrier,async t=>{
 const {jobs}=await replayCurrent(t,{change:packet=>{if(role(packet))packet.body=atOwner(packet.body,carrier)}})
 assert.equal(jobs.length,26)
})
test('caller abort on final closing detail keeps original caller reason',async t=>{
 const controller=new AbortController(),reason=Error('final caller cancelled')
 await assert.rejects(()=>replayCurrent(t,{options:{signal:controller.signal},change:(packet,{pass})=>{if(packet.url.includes('/167261-en_US')&&pass===2)controller.abort(reason)}}),error=>error===reason)
})
for(const field of ['qualifications','jobBenefits']){
 const criterion='Original additional '+field+' criterion: employees must satisfy the published role condition.'
 test('whole own role retains additional active '+field+' and existing travel/work arrangement',async t=>{
  const {jobs}=await replayCurrent(t,{change:packet=>{if(role(packet))packet.body=atOwner(packet.body,'<section itemprop="'+field+'">'+criterion+'</section>')}})
  const job=jobs.find(row=>row.jobId==='177182')
  assert.equal(jobs.length,26)
  assert.ok(job.jobDescription.includes(criterion))
  assert.ok(job.sourceDescription.includes(criterion))
  assert.match(job.jobDescription,/Travel Required\?: No Travel/)
  assert.match(job.jobDescription,/Hybrid/)
 })
 for(const closingOnly of [true,false])test('whole own '+field+' criteria drift rejects '+(closingOnly?'closing-only':'opening-only')+' addition',async t=>{
  await assert.rejects(()=>replayCurrent(t,{change:(packet,{pass})=>{if(role(packet)&&pass===(closingOnly?2:1))packet.body=atOwner(packet.body,'<section itemprop="'+field+'">'+criterion+'</section>')}}),/changed during extraction/)
 })
 for(const attr of ['hidden','inert','style="display:none"'])test('whole own role refuses unqualified inactive '+field+' '+attr,async t=>{
  await assert.rejects(()=>replayCurrent(t,{change:packet=>{if(role(packet))packet.body=atOwner(packet.body,'<section '+attr+' itemprop="'+field+'">'+criterion+'</section>')}}),/inactive|visibility|criteria/)
 })
}
for(const reason of ['opaque caller cancellation',Object.freeze({marker:'opaque-caller'}),Object.freeze(Error('frozen caller error'))])test('caller cancellation preserves opaque reason '+String(reason),async t=>{
 const controller=new AbortController()
 await assert.rejects(()=>replayCurrent(t,{options:{signal:controller.signal},change:(packet,{pass})=>{if(packet.url.includes('/167261-en_US')&&pass===2)controller.abort(reason)}}),error=>error===reason)
})
test('registered source requires the reviewed current build even if caller requests legacy fallback',async t=>{
 await assert.rejects(()=>replayCurrent(t,{options:{requireCurrentBuild:false},change:packet=>{if(packet.url.endsWith('/search/'))packet.body=packet.body.replaceAll('b2611m.4','b2605.31')}}),/Registered Colgate requires the reviewed current widget build/)
})

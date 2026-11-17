import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,extractSpringworksJobs} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
const html=packet=>Buffer.from(packet.bodyBase64,'base64').toString('utf8')
function replay(edit=(packet,text)=>text){
 const reads=[]
 const packetFor=url=>fixture.packets.find(packet=>packet.requestedURL===String(url))
 return {reads,options:{
  // Before the native path exists this feeds actual current pages through the
  // old injection boundary, exposing its current first-party title rejection.
  fetchPage:async url=>{const packet=packetFor(url);assert.ok(packet);return {status:packet.status,url:packet.url,html:html(packet)}},
  fetchImpl:async(url,init)=>{
   const original=packetFor(url);assert.ok(original,'No undeclared read '+url)
   const packet=structuredClone(original)
   assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');reads.push(String(url))
   assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),packet.sha256)
   return Object.defineProperty(new Response(edit(packet,html(packet),reads.length),{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
  },
 }}
}

test('Springworks actual eleven Remote cards have no published India country',()=>{
 const jobs=extractSpringworksJobs(html(fixture.packets.at(-1)))
 assert.equal(jobs.length,11);assert.ok(jobs.every(job=>job.location==='Remote'))
 assert.ok(jobs.every(job=>job.country===null))
})

test('Springworks current observation cannot accept foreign redirects or changed full unselected closing models',async()=>{
 for(const mode of ['redirect','closing-model','title-count']){
  const io=replay((packet,text,index)=>{
   if(mode==='redirect'&&packet.status===308)packet.headers.location='https://other.example/jobs'
   if(mode==='title-count'&&packet.requestedURL.endsWith('/jobs/springworks'))return text.replaceAll('11 Open Jobs','12 Open Jobs')
   if(mode==='closing-model'&&index===8){
    const token=JSON.stringify('"seniority":"mid"').slice(1,-1),changed=text.replace(token,token.replace('mid','unreviewed'))
    assert.ok(changed!==text,'mutate a real complete native field');return changed
   }
   return text
  })
  await assert.rejects(run(io.options),/redirect|handoff|title|Closing/i,mode)
  assert.ok(io.reads.length<=8)
 }
})

test('Springworks current acquisition preserves frozen opaque cancellation and cancels a stalled body',async()=>{
 const reason=Object.freeze({owner:'springworks-caller'}),pre=new AbortController();pre.abort(reason)
 let reads=0
 await assert.rejects(run({signal:pre.signal,fetchText:()=>'',fetchImpl:async()=>{reads++}}),error=>error===reason)
 assert.equal(reads,0)
 const controller=new AbortController(),received=Promise.withResolvers();let canceled=0
 const pending=run({signal:controller.signal,fetchImpl:async url=>{
  reads++;return Object.defineProperty(new Response(new ReadableStream({pull(){received.resolve()},cancel(){canceled++;return new Promise(()=>{})}}),
   {headers:{'content-type':'text/html'}}),'url',{value:String(url)})
 }})
 await received.promise;controller.abort(reason)
 await assert.rejects(pending,error=>error===reason)
 assert.equal(reads,1);assert.equal(canceled,1)
})

test('Springworks current employer-declared chain retains eleven whole native models without publishing brief-only cards',async()=>{
 const io=replay(),jobs=await run(io.options)
 assert.equal(io.reads.length,8)
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'springworks').observedRecordCount,11)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.wholeObservedNativeRowsClosingReconciled,true)
 assert.equal(jobs.nativeCollectionEvidence.publicApplicationEligibilityQualified,false)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,11)
 assert.ok(jobs.nativeCollectionEvidence.observations.every(row=>row.nativeRecord.locations.length===0&&row.country===null))
})

test('Springworks original country labels must explicitly say India without mixed or substring hints',()=>{
 const board=html(fixture.packets.at(-1))
 for(const location of ['Remote','Indiana','India / US','Remote, United States','Worldwide','Pune']){
  const changed=board.replaceAll('>Remote</span>','>'+location+'</span>')
  assert.ok(changed!==board||location==='Remote')
  assert.ok(extractSpringworksJobs(changed).every(job=>job.country===null),location)
 }
 for(const location of ['India','Remote, India']){
  const changed=board.replaceAll('>Remote</span>','>'+location+'</span>')
  assert.ok(extractSpringworksJobs(changed).every(job=>job.country==='India'),location)
 }
})

test('Springworks full actual eight-response default capture preserves independent closing and canonical observations',async()=>{
 const actual=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-default-20261117.json.gz',import.meta.url))))
 assert.equal(actual.requests.length,8)
 let index=0
 const jobs=await run({fetchImpl:async(url,init)=>{
  const packet=actual.requests[index++];assert.ok(packet,'No uncaptured read')
  assert.equal(String(url),packet.requestedURL);assert.equal(init.method,'GET')
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  return Object.defineProperty(new Response(bytes,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 }})
 assert.equal(index,8);assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'springworks').observedRecordCount,11)
 assert.equal(jobs.nativeCollectionEvidence.wholeObservedNativeRowsClosingReconciled,true)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Springworks observed access challenge terminates its native acquisition with original status',async()=>{
 let reads=0
 await assert.rejects(run({fetchImpl:async url=>{
  reads++
  return Object.defineProperty(new Response('',{status:202,headers:{'x-amzn-waf-action':'challenge','content-type':'text/html'}}),
   'url',{value:String(url)})
 }}),error=>error.httpStatus===202&&error.abortRetries===true)
 assert.equal(reads,1)
})

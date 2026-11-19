import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {CIKLUM_CATALOG} from './catalog.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261119.json.gz',import.meta.url))))
const profile=JSON.parse(readFileSync(new URL('./currentProfile20261119.json',import.meta.url)))
const graph=new Map(capture.responses.map(packet=>{
 const bytes=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
 return[new URL(packet.requestedURL).href,{...packet,html:bytes.toString('utf8')}]
}))
const replay=(edit=(_url,html)=>html)=>{
 const visits=[]
 const packet=url=>{const canonical=new URL(url).href;assert.ok(graph.has(canonical),'Only exact declared native reads '+url);return graph.get(canonical)}
 const read=url=>{visits.push(url);return edit(url,packet(url).html,visits.filter(value=>value===url).length)}
 return{visits,fetchText:async url=>read(url),fetchJson:async url=>JSON.parse(read(url)),fetchImpl:async(url,init={})=>{
  assert.equal(init.method,'GET')
  assert.equal(init.redirect,'manual')
  const html=read(url),original=packet(url)
  return Object.defineProperty(new Response(html,{status:original.status,headers:original.headers}),'url',{value:original.finalURL})
 }}
}

test('Ciklum current exact native client returns qualified own India criteria while ambiguous roles and company cleanup stay held',async()=>{
 const r=replay(),jobs=await run(r)
 assert.equal(jobs.length,27)
 assert.equal(r.visits.length,74)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceScopeComplete===false))
 assert.ok(jobs.every(job=>job.sourceDescription.includes('Ciklum')))
 assert.ok(jobs.some(job=>job.jobId==='4927'),'The native first-paragraph country remains explicit without a terminal period')
 assert.ok(jobs.some(job=>job.jobId==='5108'),'Blank native formatting does not replace the first substantive employer introduction')
 assert.ok(jobs.some(job=>job.jobId==='5034'),'A typed native India locality may be below the declared country facet')
 assert.ok(jobs.every(job=>job.sourceUrl.endsWith('/job/'+job.jobId)))
 assert.equal(readSourceObservationEvidence(jobs,'ciklum').observedRecordCount,30)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(assessSoftFailureAcquisition(CIKLUM_CATALOG,jobs).runnerOutcome.success,true)
 assert.ok(jobs.nativeCollectionEvidence.heldRows.some(row=>row.id==='5111'))
})

for(const mode of ['client','site-account','facet-declaration'])test('Ciklum current contract rejects '+mode+' before native feed reads',async()=>{
 const r=replay((url,html)=>{
  if(mode==='client'&&url===profile.main.url)return html+';globalThis.unreviewed=true'
  if(mode==='site-account'&&url===profile.shell.url)return html.replaceAll('CX_1001','CX_9999')
  if(mode==='facet-declaration'&&url===profile.landingURL)return html.replaceAll('selectedLocationsFacet=300000000468243','selectedLocationsFacet=300000000000000')
  return html
 })
 await assert.rejects(run(r),/Ciklum current native/)
 assert.ok(!r.visits.some(url=>url.includes('recruitingCEJobRequisitions?')))
})

for(const [label,change]of[
 ['foreign assigned country',d=>{d.PrimaryLocationCountry='US'}],
 ['foreign employer',d=>{d.ExternalDescriptionStr=d.ExternalDescriptionStr.replace('Ciklum','Other Company')}],
 ['closed criteria',d=>{d.ExternalDescriptionStr+='<p>This position is closed and no longer accepting applications.</p>'}],
 ['hidden own criteria',d=>{d.ExternalDescriptionStr='<div style="display:none">'+d.ExternalDescriptionStr+'</div>'}],
 ['foreign alternative workplace',d=>{d.otherWorkLocations=[{LocationName:'Toronto, Canada',Country:'CA'}]}],
 ['changed workplace coordinates',d=>{d.workLocation[0].Latitude='99.999'}],
])test('Ciklum quarantines '+label+' without losing unrelated current India roles',async()=>{
 const r=replay((url,html)=>{
  if(!url.includes('recruitingCEJobRequisitionDetails?')||!url.includes('%225078%22'))return html
  const p=JSON.parse(html);change(p.items[0]);return JSON.stringify(p)
 }),jobs=await run(r)
 assert.ok(jobs.length>0)
 assert.ok(!jobs.some(job=>job.jobId==='5078'))
 assert.ok(jobs.nativeCollectionEvidence.heldRows.some(row=>row.id==='5078'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Ciklum closing own-role changes are quarantined after independent native details',async()=>{
 const r=replay((url,html,count)=>{
  if(count<2||!url.includes('recruitingCEJobRequisitionDetails?')||!url.includes('%225078%22'))return html
  const p=JSON.parse(html);p.items[0].ExternalDescriptionStr+='<p>An additional current role duty.</p>';return JSON.stringify(p)
 }),jobs=await run(r)
 assert.ok(!jobs.some(job=>job.jobId==='5078'))
 assert.ok(jobs.nativeCollectionEvidence.heldRows.some(row=>row.id==='5078'&&/closing/i.test(row.reason)))
})

test('Ciklum preserves a pre-aborted opaque caller reason before any clock or acquisition callback',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancelled:'caller'})
 controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,now:()=>assert.fail('No clock callback after caller abort'),fetchImpl:()=>assert.fail('No acquisition after caller abort')}),error=>error===reason)
})

test('Ciklum source deadline bounds an ignored acquisition signal and disposes a late response',async()=>{
 const keepAlive=setTimeout(()=>{},1000)
 let release,disposed
 const disposal=new Promise(resolve=>{disposed=resolve})
 try{
  const pending=run({sourceTimeoutMs:15,fetchImpl:()=>new Promise(resolve=>{release=resolve})})
  await assert.rejects(pending,error=>error.name==='TimeoutError')
  release(Object.defineProperty(new Response(new ReadableStream({cancel(){disposed()}})),'url',{value:profile.landingURL}))
  await disposal
 }finally{clearTimeout(keepAlive)}
})

test('Ciklum stops later clock callbacks when a caller aborts while stamping the first role',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancelled:'clock'}),r=replay()
 let clocks=0
 await assert.rejects(run({...r,signal:controller.signal,now:()=>{if(++clocks===2)controller.abort(reason);return new Date().toISOString()}}),error=>error===reason)
 assert.equal(clocks,2)
})

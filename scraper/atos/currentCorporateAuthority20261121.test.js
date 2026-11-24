import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {runCurrentAtos} from './currentNative20261115.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-role-rows-20261121.json.gz',import.meta.url))))
const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url)))
const roleURL=fixture.reviewedNewRows[0].url
async function replay(t,change){
 const counts=new Map(),mutations=[]
 t.mock.method(globalThis,'fetch',()=>{throw Error('Only retained original response bytes may be read')})
 try{
  const jobs=await runCurrentAtos({now:()=>fixture.capturedAt,requestIntervalMs:0,fetchImpl:async(value,init)=>{
   const url=String(value),index=counts.get(url)??0;counts.set(url,index+1)
   const original=fixture.packets.filter(row=>row.requestedURL===url)[index]
   assert.ok(original,'No undeclared response: '+url+' #'+index)
   const packet={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString()}
   const before=packet.body;change?.(packet,url,index)
   if(packet.body!==before)mutations.push({url,index})
   assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
   const response=new Response(Buffer.from(packet.body),{status:packet.status,headers:packet.headers})
   Object.defineProperty(response,'url',{value:packet.url});return response
  }})
  return{jobs,mutations,calls:[...counts.values()].reduce((a,b)=>a+b,0)}
 }catch(error){return{error,mutations,calls:[...counts.values()].reduce((a,b)=>a+b,0)}}
}
const paragraph=(packet,text)=>{packet.body=packet.body.replace('</body>','<p>'+text+'</p></body>')}
test('the exact current 18-role originals retain complete criteria and all inventory holds',async t=>{
 const result=await replay(t);assert.ifError(result.error);assert.equal(result.jobs.length,18)
 assert.equal(result.calls,52);assert.ok(result.jobs.every(job=>job.sourceDetailComplete&&job.sourceNativeClosingReconciled))
 assert.equal(result.jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(result.jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(result.jobs.nativeCollectionEvidence.corporateAuthorityClosingReconciled,true)
 for(const kind of ['corporate','careers'])assert.deepEqual(result.jobs.nativeCollectionEvidence.openingCorporateAuthority[kind].model,result.jobs.nativeCollectionEvidence.closingCorporateAuthority[kind].model)
})

for(const[name,url,visit,text]of[
 ['reviewer closing-only Canada restriction',profile.careers,1,'All positions currently advertised on jobs.atos.net are based in Canada and require Canadian residency.'],
 ['reviewer closing-only global closure',profile.careers,1,'Applications for every advertised position are now closed.'],
 ['opening and closing foreign assignment',profile.careers,null,'All advertised appointments are administered exclusively from Toronto.'],
 ['unfamiliar closing-only employer declaration',profile.corporate,1,'The counterparty for every advertised engagement is now Example Research Limited.'],
 ['closing-only application authority',profile.corporate,1,'For every advertised position, send all documents to recruiting@example.test.'],
 ['closing-only unfamiliar withdrawal wording',profile.careers,1,'Every opportunity shown on the linked platform has been rescinded.'],
 ['unrecognised standalone closing-only text',profile.careers,1,'Effective immediately: these advertisements are an archival catalogue.'],
])test('corporate text qualification holds '+name,async t=>{
 const result=await replay(t,(packet,current,index)=>{if(current===url&&(visit===null||index===visit))paragraph(packet,text)})
 assert.ok(result.mutations.length>0,'The negative must alter actual original bytes')
 assert.match(result.error?.message??'',/Atos current native/)
 assert.equal(result.error.lifecycleCleanupAllowed,false)
})

test('a restriction appended inside an existing corporate marketing paragraph is authority',async t=>{
 const result=await replay(t,(packet,url,index)=>{
  if(url===profile.corporate&&index===1){
   const sentence='Driven by technological breakthroughs and rapidly evolving geopolitical challenges, Europe has reached an inflection point.'
   assert.ok(packet.body.includes(sentence));packet.body=packet.body.replace(sentence,sentence+' Every advertised engagement is now administered exclusively from Toronto.')
  }
 })
 assert.equal(result.mutations.length,1);assert.match(result.error?.message??'',/Atos current native/)
})

test('reviewed marketing metadata wording can vary without changing recruitment authority',async t=>{
 const result=await replay(t,(packet,url,index)=>{if(url===profile.corporate&&index===1)packet.body=packet.body.replaceAll('combines agentic AI','combines current AI')})
 assert.equal(result.mutations.length,1);assert.ifError(result.error);assert.equal(result.jobs.length,18)
})

function completeNewsSlider(html){
 const marker='<div data-df-id="atosai_blog:slider"',start=html.indexOf(marker)
 assert.ok(start>=0);assert.equal(html.indexOf(marker,start+marker.length),-1)
 const tags=/<\/?div\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/g
 tags.lastIndex=start;let depth=0,match
 while((match=tags.exec(html))){
  depth+=match[0].startsWith('</')?-1:1
  if(depth===0)return html.slice(start,tags.lastIndex)
 }
 assert.fail('Complete original marketing module boundary is required')
}

test('another complete reviewed original news model may change at closing while authority reconciles',async t=>{
 const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
 const original=historical.packets.find(packet=>packet.requestedURL===profile.corporate)
 const reviewed=completeNewsSlider(Buffer.from(original.bodyBase64,'base64').toString())
 const result=await replay(t,(packet,url,index)=>{if(url===profile.corporate&&index===1)packet.body=packet.body.replace(completeNewsSlider(packet.body),reviewed)})
 assert.equal(result.mutations.length,1);assert.ifError(result.error);assert.equal(result.jobs.length,18)
 const evidence=result.jobs.nativeCollectionEvidence
 assert.deepEqual(evidence.openingCorporateAuthority.corporate.model,evidence.closingCorporateAuthority.corporate.model)
 assert.notDeepEqual(evidence.openingCorporateAuthority.corporate.reviewedMarketing,evidence.closingCorporateAuthority.corporate.reviewedMarketing)
})

test('an unreviewed authority statement inside a reviewed news slot cannot inherit its marketing exception',async t=>{
 const result=await replay(t,(packet,url,index)=>{
  if(url===profile.corporate&&index===1){
   const slider=completeNewsSlider(packet.body)
   assert.ok(slider.includes('When probability meets accountability'))
   packet.body=packet.body.replace(slider,slider.replace('When probability meets accountability','Every opportunity shown on the linked platform has been rescinded.'))
  }
 })
 assert.equal(result.mutations.length,1);assert.match(result.error?.message??'',/Atos current native/)
})

test('unreviewed application authority in a marketing metadata field stays held',async t=>{
 const result=await replay(t,(packet,url,index)=>{if(url===profile.corporate&&index===1)packet.body=packet.body.replace(/(<meta name="description" content=")[^"]+"/,'$1Applications for every advertised position are now closed."')})
 assert.equal(result.mutations.length,1);assert.match(result.error?.message??'',/Atos current native/)
})

const criterionStart=/data-careersite-propertyid="description"[^>]*>/
for(const[name,text]of[
 ['country and residence','These positions are based in Canada and require Canadian residency.'],
 ['employer','Your appointment is with Example Research Limited.'],
 ['application','Applications must be submitted to recruiting@example.test.'],
 ['closure','Applications for this advertised position are now closed.'],
])test('complete own role criteria still bind '+name+' authority',async t=>{
 const result=await replay(t,(packet,url)=>{
  if(url===roleURL){assert.match(packet.body,criterionStart);packet.body=packet.body.replace(criterionStart,start=>start+'<p>'+text+'</p>')}
 })
 assert.ok(result.mutations.length>0);assert.match(result.error?.message??'',/Atos current native/)
})

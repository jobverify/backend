import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentHyperscienceProgramme} from '../scraper/hyperscience/currentProgramme.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/hyperscience-current-prefix-20261120.json.gz',import.meta.url))))
const current=kind=>fixture.responses.find(r=>r.kind===kind)
const sha=b=>createHash('sha256').update(b).digest('hex')
const payload=JSON.parse(Buffer.from(current('A').bodyBase64,'base64'))
function packet(source){
 const body=Buffer.from(source.bodyBase64,'base64'),at=new Date().toISOString(),r=source.receipt
 assert.equal(sha(body),r.sha256);assert.equal(body.length,r.bytes)
 const headers=structuredClone(r.headers)
 return{body,receipt:{requestedURL:r.requestedURL,finalURL:r.finalURL,status:r.status,headers,headerEntries:Object.entries(headers),method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',requestedAt:at,responseAt:at,completedAt:at,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length,discardedOverflowBytes:0,overflowBytes:0,bodyComplete:true,streamDone:true,decodedPrefixOnly:false,error:null,evidenceKind:'controlled-delivery-of-dated-unmodified-original-body'}}
}
test('actual current corporate/API prefix reaches declared own detail and retains all three changed native records before missing detail hold',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 const calls=[],unacquired=Object.assign(Error('Current own detail has not been acquired in the dated retained prefix'),{code:'CURRENT_OWN_DETAIL_NOT_ACQUIRED'})
 let held
 try{
  await readCurrentHyperscienceProgramme({readPage:async(url)=>{
   calls.push(url)
   const source=fixture.responses.slice(0,3).find(r=>r.receipt.requestedURL===url)
   if(source)return packet(source)
   assert.equal(url,payload.jobs[0].jobUrl)
   throw unacquired
  }})
 }catch(e){held=e}
 if(calls.length!==4)t.diagnostic(JSON.stringify({gate:held?.gate,message:held?.message,code:held?.code,reads:calls.length}))
 assert.equal(calls.length,4,'Only original current C0/C1/A then first exact current own detail')
 assert.equal(held.code,'CURRENT_OWN_DETAIL_NOT_ACQUIRED')
 const audit=held.nativeCollectionEvidence
 assert.equal(audit.nativePayload.jobs.length,3)
 assert.equal(sha(JSON.stringify(audit.nativePayload)),sha(JSON.stringify(payload)))
 assert.equal(audit.currentTransactionQualified,false)
 assert.equal(audit.allChannelsClosed,false)
 assert.equal(audit.nativeIndiaCount,null)
 assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.rawPages.length,4)
})

const {readInitialHyperscienceCorporate,hyperscienceCorporateComparison}=await import('../scraper/hyperscience/currentProgrammeData.js')
function editPacket(kind,edit){
 const record=packet(current(kind));record.body=Buffer.from(edit(record.body.toString()))
 Object.assign(record.receipt,{bodyBytes:record.body.length,bodySHA256:sha(record.body),consumedBodyBytes:record.body.length})
 if(Object.hasOwn(record.receipt.headers,'content-length'))record.receipt.headers['content-length']=String(record.body.length)
 record.receipt.headerEntries=Object.entries(record.receipt.headers);return record
}
test('actual current Nitro heartbeat difference leaves full authored corporate facts equal',()=>{
 const opening=readInitialHyperscienceCorporate(packet(current('C1')),'C1')
 const closing=readInitialHyperscienceCorporate(packet(current('C1-closing')),'C1')
 assert.notEqual(opening.packet.bytes.length,closing.packet.bytes.length)
 assert.equal(sha(JSON.stringify(hyperscienceCorporateComparison(opening))),sha(JSON.stringify(hyperscienceCorporateComparison(closing))))
 assert.equal(opening.cards.length,3)
 assert.equal(opening.cards[2].title,payload.jobs[2].title)
})
test('unrelated style, telemetry and marketing text are provenance rather than native authority gates',()=>{
 const original=readInitialHyperscienceCorporate(packet(current('C1')),'C1')
 const changed=readInitialHyperscienceCorporate(editPacket('C1',s=>s+'<style>.unrelated{color:purple}</style><script>window.analyticsRelease="local-only"</script><p>Our newest AI platform release.</p>'),'C1')
 assert.notEqual(original.packet.bytes.length,changed.packet.bytes.length)
 assert.equal(sha(JSON.stringify(hyperscienceCorporateComparison(original))),sha(JSON.stringify(hyperscienceCorporateComparison(changed))))
})
for(const[name,edit]of[
 ['active eligibility',s=>s+'<p>Applicants must reside in India.</p>'],
 ['new recruiting authority',s=>s+'<a href="https://other.example/jobs">Current openings</a>'],
 ['additional JobPosting',s=>s+'<script type="application/ld+json">{"@type":"JobPosting","title":"Unaccounted"}</script>'],
 ['unbound location metadata',s=>s.replace('class="posts-archive"','class="posts-archive" data-country="India"')],
 ['new criterion inside card',s=>s.replace('<div class="separator"></div>','<div class="separator"></div><p>Additional mandatory certification.</p>')],
 ['foreign native role',s=>s.replace('https://jobs.ashbyhq.com/hyperscience/'+payload.jobs[0].id,'https://jobs.ashbyhq.com/other/'+payload.jobs[0].id)],
])test('current corporate '+name+' cannot silently preserve authority',()=>{
 assert.throws(()=>readInitialHyperscienceCorporate(editPacket('C1',edit),'C1'),e=>e.code==='HYPERSCIENCE_PROGRAMME_HOLD')
})
test('changed current API title alone remains inconsistent with the same-ID corporate card',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 let held,calls=0
 try{await readCurrentHyperscienceProgramme({readPage:async url=>{
  calls++;const row=fixture.responses.slice(0,3).find(r=>r.receipt.requestedURL===url)
  assert.ok(row)
  if(row.kind!=='A')return packet(row)
  return editPacket('A',s=>{const v=JSON.parse(s);v.jobs[2].title+=' changed';return JSON.stringify(v)})
 }})}catch(e){held=e}
 assert.equal(calls,3);assert.equal(held.gate,'membership');assert.equal(held.nativeCollectionEvidence.allChannelsClosed,false)
})
test('malformed passive Age cannot become valid response provenance',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 let held,calls=0
 try{await readCurrentHyperscienceProgramme({readPage:async url=>{
  calls++;const record=packet(fixture.responses.slice(0,3).find(r=>r.receipt.requestedURL===url))
  if(url===current('A').receipt.requestedURL){record.receipt.headers.age='not-a-number';record.receipt.headerEntries=Object.entries(record.receipt.headers)}
  return record
 }})}catch(e){held=e}
 assert.equal(calls,3);assert.equal(held.gate,'security');assert.equal(held.nativeCollectionEvidence.nativeIndiaCount,null)
})

test('full controlled historical protocol closes authored facts despite the actual current passive Nitro program',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('NETWORK FORBIDDEN'))
 const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/hyperscience-server-programme-components-20261111.json.gz',import.meta.url))))
 const original=kind=>{const row=historical.responses.find(r=>r.kind===kind);assert.ok(row);return{body:Buffer.from(row.bodyBase64,'base64'),receipt:structuredClone(row.receipt)}}
 const {documentEntries}=await import('../scraper/hyperscience/currentProgrammeRenderer.js')
 const actualProgramme=documentEntries(Buffer.from(current('C1').bodyBase64,'base64').toString()).entries.find(e=>e.node.tag==='script'&&e.node.raw?.includes('nitroHeartbeat')).node.raw
 const byURL=new Map(historical.responses.filter(r=>!r.kind.startsWith('Q')).map(r=>[r.receipt.requestedURL,r.kind]))
 const api=JSON.parse(original('A').body),own=api.jobs.map(j=>j.jobUrl)
 const route=kind=>original(kind).receipt.requestedURL
 const plan=[...['C0','C1','A'].map(route),...own,...['H','M','S','Q-first'].map(route),...own.toReversed(),...['Q-repeat','S','M','H','A','C1','C0'].map(route)]
 const q=route('Q-first');let calls=0
 const jobs=await readCurrentHyperscienceProgramme({readPage:async(url,init)=>{
  assert.equal(url,plan[calls]);const opening=calls<11;calls++
  const row=original(url===q?(opening?'Q-first':'Q-repeat'):byURL.get(url))
  assert.equal(init.method,url===q?'POST':'GET')
  if(url===route('C1')&&opening)row.body=Buffer.from(row.body.toString()+'<script nitro-exclude>'+actualProgramme+'</script>')
  const at=new Date().toISOString()
  Object.assign(row.receipt,{requestedAt:at,responseAt:at,completedAt:at,bodyBytes:row.body.length,bodySHA256:sha(row.body),bodyComplete:true,streamDone:true,decodedPrefixOnly:false,error:null,consumedBodyBytes:row.body.length,discardedOverflowBytes:0,overflowBytes:0,evidenceKind:'controlled-historical-originals-plus-genuine-current-passive-program'})
  row.receipt.headerEntries=Object.entries(row.receipt.headers)
  return row
 }})
 const audit=jobs.nativeCollectionEvidence,corporate=audit.openingClosingEquality.find(r=>r.kind==='C1')
 assert.equal(calls,22);assert.equal(jobs.length,0);assert.equal(audit.nativeRecords.length,4)
 assert.equal(corporate.wholeRawEntityEqual,false);assert.equal(corporate.corporateAuthoredFactsEqual,true)
 assert.equal(audit.allWholeBodiesEqual,false);assert.equal(audit.allChannelsClosed,true)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.rendererConsumptionQualified,false)
})

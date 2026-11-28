import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {BOARD} from './nativeContract.js'
import {readNativeData} from './nativeData.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-native-workflow-20261128.json.gz',import.meta.url))))
for(const packet of capture.packets)assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
const changeCarrier=(packet,name,mutate)=>{
  const value=structuredClone(readNativeData(packet.body,name))
  mutate(value)
  let replaced=false
  packet.body=packet.body.replace(new RegExp('(\\b'+name+'\\s*=\\s*)([^\\r\\n]+)'),(_match,prefix,line)=>{
    replaced=true
    return prefix+JSON.stringify(value).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||'')
  })
  assert.equal(replaced,true)
}
const boardPackets=packets=>packets.filter(packet=>packet.requestedUrl===BOARD)
const rolePackets=packets=>packets.filter(packet=>packet.requestedUrl!==BOARD)

function replay(mutate=()=>{},overrides={}){
  const pending=structuredClone(capture.packets),requests=[]
  mutate(pending)
  return{requests,pending,execute:()=>run({now:capture.startedAt,detailConcurrency:1,fetchImpl:async(url,init)=>{
    assert.equal(init.method??'GET','GET')
    assert.equal(init.body,undefined)
    const index=pending.findIndex(packet=>packet.requestedUrl===url)
    assert.notEqual(index,-1,'Only genuine captured public reads are allowed: '+url)
    const [packet]=pending.splice(index,1)
    requests.push(url)
    assert.equal(packet.status,200)
    assert.equal(packet.url,url)
    return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
  },...overrides})}
}

test('genuine current Checkmarx workflow retains22 raw native records and both full India criteria while company scope and cleanup stay held',async()=>{
  const attempt=replay(),jobs=await attempt.execute()
  assert.equal(attempt.pending.length,0)
  assert.equal(attempt.requests.length,4)
  assert.ok(attempt.requests.every(url=>new URL(url).origin==='https://www.comeet.com'&&!new URL(url).search&&!new URL(url).hash))
  assert.deepEqual(jobs.map(job=>job.jobId),['5D.474','C7.471'])
  assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceDescription.length>100))
  assert.ok(jobs.every(job=>job.postingDate===null&&job.closingDate===null&&job.nativeUpdatedAt))
  assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
  assert.ok(jobs.every(job=>job.applicationSubmitted===false&&job.applicationVisited===false&&job.activeApplyVerified===false))
  const evidence=jobs.nativeCollectionEvidence
  const [opening,closing]=boardPackets(capture.packets).map(packet=>readNativeData(packet.body,'COMPANY_POSITIONS_DATA'))
  assert.deepEqual(evidence.openingNativeRows,opening)
  assert.deepEqual(evidence.closingNativeRows,closing)
  assert.equal(opening.length,22)
  assert.equal(opening.filter(row=>new URL(row.url_active_page).hash==='#Hiring').length,6)
  assert.equal(evidence.observations.length,22)
  assert.deepEqual(evidence.observations.map(row=>row.nativeSourceRecord),opening)
  assert.deepEqual(evidence.observations.map(row=>row.nativeClosingRecord),closing)
  assert.equal(evidence.wholeNativeBoardClosingReconciled,true)
  assert.equal(evidence.observedNativeIndiaRows,2)
  assert.equal(evidence.observedPublicIndiaRows,2)
  assert.equal(evidence.companyGlobalTotal,null)
  assert.equal(evidence.companyIndiaTotal,null)
  assert.equal(evidence.sourceScopeComplete,false)
  assert.equal(evidence.lifecycleCleanupAllowed,false)
  assert.equal(evidence.applicationInteractions,0)
  assert.equal(evidence.originalResponses.length,4)
  for(const response of evidence.originalResponses){
    const bytes=Buffer.from(response.bodyBase64,'base64')
    assert.equal(bytes.length,response.bodyBytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'),response.bodySHA256)
    assert.ok(capture.packets.some(packet=>packet.requestedUrl===response.requestedURL&&packet.sha256===response.bodySHA256))
  }
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.status,'coverage-gap')
  assert.equal(inventory.listingComplete,false)
  assert.equal(inventory.reportedTotal,null)
  assert.equal(inventory.indiaFacetCount,null)
  assert.match(inventory.reason,/company-wide-scope-unproven/)
})

for(const[label,mutate]of[
  ['a foreign native employer account',packets=>changeCarrier(boardPackets(packets)[0],'COMPANY_DATA',company=>{company.company_uid='X0.000'})],
  ['a mismatched role identity',packets=>changeCarrier(rolePackets(packets)[0],'POSITION_DATA',row=>{row.uid='00.000'})],
  ['a foreign native detail URL',packets=>changeCarrier(rolePackets(packets)[0],'POSITION_DATA',row=>{row.url_comeet_hosted_page=row.url_comeet_hosted_page.replace('www.comeet.com','foreign.invalid');row.url_recruit_hosted_page=row.url_comeet_hosted_page})],
  ['a contradictory detail country',packets=>changeCarrier(rolePackets(packets)[0],'POSITION_DATA',row=>{row.location.country='US'})],
  ['an employee-only role detail',packets=>changeCarrier(rolePackets(packets)[0],'POSITION_DATA',row=>{row.is_internal=true})],
  ['a fragment on an India first-party role',packets=>changeCarrier(rolePackets(packets)[0],'POSITION_DATA',row=>{row.url_active_page+='#Hiring';row.url_detected_page=row.url_active_page})],
  ['a changed closing native record',packets=>changeCarrier(boardPackets(packets)[1],'COMPANY_POSITIONS_DATA',rows=>{rows[0].name+=' changed'})],
  ['a future native update clock',packets=>changeCarrier(boardPackets(packets)[0],'COMPANY_POSITIONS_DATA',rows=>{rows[0].time_updated=new Date(Date.parse(capture.completedAt)+86400000).toISOString()})],
  ['a second native country carrier',packets=>changeCarrier(boardPackets(packets)[0],'COMPANY_POSITIONS_DATA',rows=>{rows[0].additional_locations=[{country:'IN'}]})],
])test('current Checkmarx workflow refuses '+label,async()=>{
  await assert.rejects(replay(mutate).execute(),/Checkmarx native (?:contract|run):/)
})

test('current Checkmarx workflow preserves missing criteria as incomplete instead of inventing a full role',async()=>{
  const attempt=replay(packets=>changeCarrier(rolePackets(packets)[0],'POSITION_DATA',row=>{
    row.custom_fields.details.find(field=>field.name==='Requirements').value=''
  }))
  const jobs=await attempt.execute()
  assert.equal(jobs.length,2)
  const held=jobs.find(job=>job.jobId===readNativeData(rolePackets(capture.packets)[0].body,'POSITION_DATA').uid)
  assert.equal(held.sourceDetailComplete,false)
  assert.equal(held.sourceDescription,null)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})

test('current Checkmarx workflow respects cancellation before native reads',async()=>{
  const attempt=replay(()=>{},{signal:AbortSignal.abort(Error('cancel current Checkmarx'))})
  await assert.rejects(attempt.execute(),/cancel current Checkmarx/)
  assert.equal(attempt.requests.length,0)
})

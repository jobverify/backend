import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {CAREERS_URL,PROXY_URL,GRAPHQL_URL} from './native.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-workflow-20261128.json.gz',import.meta.url))))
for(const packet of capture.packets)assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
const operation=packet=>packet.requestedUrl===GRAPHQL_URL?JSON.parse(packet.requestBody)[0]:null
const listingPackets=packets=>packets.filter(packet=>operation(packet)?.operationName==='JobBoardList')
const detailPackets=packets=>packets.filter(packet=>operation(packet)?.operationName==='ExternalJobPosting')
const changeData=(packet,mutate)=>{const value=JSON.parse(packet.body);mutate(value[0].data);packet.body=JSON.stringify(value)}

function replay(mutate=()=>{},overrides={}){
  const pending=structuredClone(capture.packets),requests=[]
  mutate(pending)
  const take=(url,init={})=>{
    const index=pending.findIndex(packet=>packet.requestedUrl===url&&packet.method===(init.method??'GET')&&(packet.requestBody??null)===(init.body??null))
    assert.notEqual(index,-1,'Only genuine captured read operations are allowed: '+url)
    const [packet]=pending.splice(index,1)
    requests.push({url,method:init.method??'GET',body:init.body??null})
    assert.equal(packet.status,200)
    assert.equal(packet.url,url)
    return packet
  }
  return{requests,pending,execute:()=>run({now:()=>capture.startedAt,
    fetchPage:async(url,init)=>{const packet=take(url,init);return{status:packet.status,finalUrl:packet.url,html:packet.body}},
    fetchJson:async(url,init)=>JSON.parse(take(url,init).body),...overrides})}
}

test('genuine current Accellor workflow preserves all20 native rows and11 full India criteria with independent city-count holds',async()=>{
  const attempt=replay(),jobs=await attempt.execute()
  assert.equal(attempt.pending.length,0)
  assert.equal(attempt.requests.length,15)
  const originals=listingPackets(capture.packets).map(packet=>JSON.parse(packet.body))
  const opening=originals[0][0].data.oatsExternalJobPostings.jobPostings
  assert.equal(opening.length,20)
  assert.deepEqual(jobs.map(job=>job.jobId),opening.filter(row=>row.locations.some(location=>location.isoCountry==='IND')).map(row=>row.extId))
  assert.equal(jobs.length,11)
  assert.equal(new Set(jobs.map(job=>job.jobId)).size,11)
  assert.ok(jobs.every(job=>job.company==='Accellor'&&job.country==='India'&&job.sourceDetailComplete&&job.sourceDescription.length>1000))
  assert.ok(jobs.every(job=>job.sourceListingComplete===false&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
  assert.ok(jobs.every(job=>job.sourceUrl===job.applyUrl&&job.sourceUrl.startsWith('https://jobs.gem.com/accellor/')))
  const evidence=jobs.nativeCollectionEvidence
  assert.deepEqual(evidence.openingNativePayload,originals[0])
  assert.deepEqual(evidence.closingNativePayload,originals[1])
  assert.deepEqual(evidence.employerProxyPayload,JSON.parse(capture.packets.find(packet=>packet.requestedUrl===PROXY_URL).body))
  assert.deepEqual(evidence.nativeDetailPayloads,detailPackets(capture.packets).map(packet=>({extId:operation(packet).variables.extId,payload:JSON.parse(packet.body)})))
  assert.equal(evidence.openingDepartmentPartition.assignedPostingCount,19)
  assert.deepEqual(evidence.openingDepartmentPartition.unassignedPostingIds,['am9icG9zdDoCb6RprZVQs9vxKew_zmQk'])
  assert.ok(evidence.openingDepartmentPartition.departments.every(partition=>partition.reportedCount===partition.observedCount))
  assert.deepEqual(evidence.openingLocationFilterDisagreements.map(value=>[value.reportedCount,value.observedCount]).sort(),[[2,1],[5,4]])
  assert.deepEqual(evidence.openingLocationFilterDisagreements,evidence.closingLocationFilterDisagreements)
  assert.equal(evidence.nativePostingProjectionClosingReconciled,true)
  assert.deepEqual(evidence.nativePostingClosingProjectionFields,['board.id','id','extId','title','job','locations'])
  assert.equal(evidence.companyScopeComplete,false)
  assert.equal(evidence.companyGlobalTotal,null)
  assert.equal(evidence.companyIndiaTotal,null)
  assert.equal(evidence.lifecycleCleanupAllowed,false)
  assert.equal(evidence.applicationInteractions,0)
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.status,'coverage-gap')
  assert.equal(inventory.reportedTotal,20)
  assert.equal(inventory.indiaFacetCount,null)
  assert.equal(inventory.listingComplete,false)
  assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.match(inventory.reason,/native-location-filter-counts-unreconciled/)
})

for(const[label,mutate]of[
  ['a different employer proxy role',packets=>{const packet=packets.find(p=>p.requestedUrl===PROXY_URL),value=JSON.parse(packet.body);value.jobs[0].url=value.jobs[0].url.replace('/accellor/','/other/');packet.body=JSON.stringify(value)}],
  ['a changed closing native role',packets=>changeData(listingPackets(packets)[1],value=>{value.oatsExternalJobPostings.jobPostings[0].title+=' changed'})],
  ['an incorrect closing department count',packets=>changeData(listingPackets(packets)[1],value=>{value.oatsExternalJobPostingsFilters.find(filter=>filter.type==='DEPARTMENT'&&filter.count>0).count++})],
  ['a conflicting detail employer',packets=>changeData(detailPackets(packets)[0],value=>{value.oatsExternalJobPosting.job.teamDisplayName='Other employer'})],
  ['a mismatched detail posting',packets=>changeData(detailPackets(packets)[0],value=>{value.oatsExternalJobPosting.extId='foreign-posting-identity'})],
  ['a contradictory native detail country',packets=>changeData(detailPackets(packets)[0],value=>{value.oatsExternalJobPosting.locations[0].isoCountry='USA'})],
  ['an omitted native job location',packets=>changeData(detailPackets(packets)[0],value=>{value.oatsExternalJobPosting.job.locations=[]})],
  ['a hidden application',packets=>changeData(detailPackets(packets)[0],value=>{value.oatsExternalJobPosting.isApplicationFormHidden=true})],
  ['an unlisted posting',packets=>changeData(detailPackets(packets)[0],value=>{value.oatsExternalJobPosting.isUnlistedExternally=true})],
  ['missing native criteria',packets=>changeData(detailPackets(packets)[0],value=>{value.oatsExternalJobPosting.descriptionHtml=''})],
  ['a future native publication',packets=>changeData(detailPackets(packets)[0],value=>{value.oatsExternalJobPosting.firstPublishedTsSec=Math.floor(Date.parse(capture.completedAt)/1000)+86400})],
  ['a proxy example inside inert textarea',packets=>{packets.find(packet=>packet.requestedUrl===CAREERS_URL).body='<textarea><script>fetch("https://workable-proxy-lyart.vercel.app/api/gem-jobs")</script></textarea>'}],
])test('current Accellor workflow refuses '+label,async()=>{
  await assert.rejects(replay(mutate).execute(),/Accellor native inventory:/)
})

test('current Accellor workflow respects cancellation before reads and rejects caller truncation',async()=>{
  const cancelled=replay(()=>{},{signal:AbortSignal.abort(Error('cancel current Accellor'))})
  await assert.rejects(cancelled.execute(),/cancel current Accellor/)
  assert.equal(cancelled.requests.length,0)
  const capped=replay(()=>{},{maxJobs:1})
  await assert.rejects(capped.execute(),/caller cap/)
  assert.equal(capped.requests.length,0)
})

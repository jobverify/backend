import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/country-quarantine-20261114.json.gz',import.meta.url))))
const source=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='bostonscientific'))
const quarantined=563602813924834,verified=[563602812725423,563602813776593]
const facetURL=url=>url.includes('/api/pcsx/search')&&url.includes('filter_country=India')
const replay=(mutate=()=>{})=>{
 const seen=new Map(),calls=[]
 const read=async(url,options)=>{
  options.signal.throwIfAborted();calls.push(url)
  const packets=capture.packets.filter(row=>row.requestedUrl===url),index=seen.get(url)||0
  seen.set(url,index+1)
  assert.ok(packets[index],'Only retained current native requests are allowed: '+url+' #'+index)
  const packet=structuredClone(packets[index]);mutate(packet,url,index)
  return packet.body
 }
 return {calls,options:{now:()=>capture.capturedAt,fetchText:read,fetchJson:async(url,options)=>JSON.parse(await read(url,options))}}
}
const changeJSON=(packet,change)=>{const value=JSON.parse(packet.body);change(value.data);packet.body=JSON.stringify(value)}

test('retained November14 native global/facet/detail/closing responses preserve original hashes',()=>{
 assert.equal(capture.packets.length,61)
 for(const packet of capture.packets)assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
})

test('registered source retains two proven India roles while accounting for the exact third native facet row',async()=>{
 const io=replay(),jobs=await source().run(io.options),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs.map(job=>job.jobId),verified)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===true&&job.jobDescription.length>1000))
 assert.ok(jobs.every(job=>job.sourceListingComplete===false&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(io.calls.some(url=>url.includes('position_id='+quarantined)),false)
 assert.equal(audit.observedNativeRecords,525);assert.equal(audit.observedFacetRecords,3)
 assert.equal(audit.verifiedIndiaRecords,2);assert.equal(audit.quarantinedFacetRecords,1)
 assert.equal(audit.quarantinedFacetRoles[0].id,quarantined)
 assert.deepEqual(audit.quarantinedFacetRoles[0].locations,['Ahmedabad, India | India-Maharashtra, Pune'])
 assert.deepEqual(audit.quarantinedFacetRoles[0].standardizedLocations,['Pune, MH, IN'])
 assert.equal(audit.unresolvedGlobalRoles.length,15)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.reportedTotal,525);assert.equal(evidence.indiaFacetCount,3)
 assert.equal(evidence.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const[name,change]of[
 ['changed quarantined raw country',data=>{data.positions[0].locations=['Ahmedabad, Canada | Canada-Pune']}],
 ['changed quarantined title',data=>{data.positions[0].name+=' changed'}],
 ['duplicate quarantined identity',data=>{data.positions[1]=structuredClone(data.positions[0])}],
 ['unlisted quarantined identity',data=>{data.positions[0].id++}],
 ['a facet count below the proven India subset',data=>{data.count=1}],
])test('native facet quarantine cannot hide '+name,async()=>{
 const io=replay((packet,url)=>{if(facetURL(url)&&url.includes('start=0'))changeJSON(packet,change)})
 await assert.rejects(source().run(io.options),/native identity|drift|facet|Duplicate/i)
})

test('a known foreign native row cannot be quarantined as an unexplained India facet member',async()=>{
 const foreign=JSON.parse(capture.packets.find(packet=>packet.requestedUrl.includes('start=0&limit=10')&&!facetURL(packet.requestedUrl)).body).data.positions[0]
 const io=replay((packet,url)=>{if(facetURL(url)&&url.includes('start=0'))changeJSON(packet,data=>{data.positions[0]=foreign})})
 await assert.rejects(source().run(io.options),/unproven India|foreign|facet/i)
})

test('closing global listing drift still rejects the entire result',async()=>{
 const io=replay((packet,url,index)=>{if(!facetURL(url)&&url.includes('/search?')&&url.includes('start=0&limit=10')&&index===1)changeJSON(packet,data=>{data.positions[0].name+=' changed'})})
 await assert.rejects(source().run(io.options),/snapshot drift/)
})

test('the complete native facet terminal count stays strict after quarantine',async()=>{
 const io=replay((packet,url)=>{if(facetURL(url)&&url.includes('start=10'))changeJSON(packet,data=>{data.count++})})
 await assert.rejects(source().run(io.options),/India terminal drift/)
})

test('an entirely unresolved native facet retains all raw counts and cannot certify India zero or cleanup',async()=>{
 const io=replay((packet,url)=>{
  if(!url.includes('/api/pcsx/search'))return
  changeJSON(packet,data=>{for(const row of data.positions)if(verified.includes(row.id)){row.locations=['Unresolved Remote'];row.standardizedLocations=['Unresolved Remote']}})
 })
 const jobs=await source().run(io.options),audit=jobs.nativeCollectionEvidence,evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0)
 assert.equal(audit.observedNativeRecords,525);assert.equal(audit.observedFacetRecords,3)
 assert.equal(audit.verifiedIndiaRecords,0);assert.equal(audit.quarantinedFacetRecords,3)
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,525);assert.equal(evidence.indiaFacetCount,3)
 assert.equal(evidence.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const[name,change]of[
 ['detail identity',data=>{data.id++}],
 ['detail country',data=>{data.locations=['Toronto, Canada'];data.standardizedLocations=['Toronto, ON, CA']}],
 ['native publication',data=>{data.positionUserActions.applyAction.status='denied'}],
])test('selected India role still rejects changed '+name,async()=>{
 const io=replay((packet,url)=>{if(url.includes('position_id='+verified[0]))changeJSON(packet,change)})
 await assert.rejects(source().run(io.options),/mismatch|not allowed|country/i)
})

test('hidden description stays incomplete and cannot authorize inventory cleanup',async()=>{
 const io=replay((packet,url)=>{if(url.includes('position_id='+verified[0]))changeJSON(packet,data=>{data.jobDescription='<div hidden>Build and maintain important production systems.</div>'})})
 const jobs=await source().run(io.options)
 assert.equal(jobs.find(job=>job.jobId===verified[0]).sourceDetailComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('original opaque caller cancellation stops at the first country facet request',async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancel:'original reason'})
 const io=replay((_packet,url)=>{if(facetURL(url))controller.abort(reason)})
 await assert.rejects(source().run({...io.options,signal:controller.signal}),error=>error===reason)
 assert.equal(io.calls.some(url=>url.includes('position_details')),false)
})

test('an already cancelled caller prevents every native request',async()=>{
 const reason=Object.freeze({cancel:'before first request'}),io=replay()
 await assert.rejects(source().run({...io.options,signal:AbortSignal.abort(reason)}),error=>error===reason)
 assert.equal(io.calls.length,0)
})

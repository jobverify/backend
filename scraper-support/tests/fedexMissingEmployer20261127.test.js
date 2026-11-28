import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from '../../scraper/fedex/script.js'
import {readParadoxPreload} from '../shared/paradoxPublicInventory.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/fedex-missing-employer-20261127.json.gz',import.meta.url))))
const [listing,opening,closing,unqualified]=fixture.packets
const original=readParadoxPreload(listing.body)
const good=original.jobSearch.jobs.find(row=>row.reference==='RC785024')
const held=original.jobSearch.jobs.find(row=>row.reference==='RC775518')
const posting=html=>JSON.parse(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1])

// Isolate unchanged native rows in a synthetic smaller search model; the four
// original HTTP responses are retained unchanged in the fixture.
function replay({rows=[good,held],changeClosing,changeDetail}={}){
 const calls=[];let pages=0,details=0
 return{calls,async fetchText(url){
  calls.push(url)
  if(url===listing.requestedUrl){
   const state=structuredClone(original)
   state.jobSearch={...state.jobSearch,jobs:structuredClone(rows),totalJob:rows.length,facets:[]}
   if(++pages===2)changeClosing?.(state)
   return '<script>window.__PRELOAD_STATE__ = '+JSON.stringify(state)+';window.__BUILD__="controlled-current-subset";</script>'
  }
  if(url===opening.requestedUrl){const body=++details===1?opening.body:closing.body;return changeDetail?changeDetail(body,details):body}
  if(url===unqualified.requestedUrl)return unqualified.body
  assert.fail('Uncaptured request '+url)
 }}
}
const options=io=>({fetchText:io.fetchText,maxPages:1,maxJobs:3,now:new Date('2026-11-27T18:25:56Z')})

test('original current responses distinguish the qualified employer from an absent employer',()=>{
 for(const packet of fixture.packets){assert.equal(packet.status,200);assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)}
 assert.equal(good.brandName,'FedEx Logistics AMEA')
 assert.equal(posting(opening.body).hiringOrganization.name,good.brandName)
 assert.equal(Object.hasOwn(held,'brandName'),false)
 assert.equal(posting(unqualified.body).hiringOrganization.name,'')
})

test('one missing employer is held while an independent full native India role survives',async()=>{
 const io=replay(),jobs=await run(options(io))
 assert.equal(jobs.length,1)
 const job=jobs[0]
 assert.equal(job.jobId,good.reference)
 assert.equal(job.sourceDescription,posting(opening.body).description)
 assert.deepEqual(job.nativeJobPosting,posting(opening.body))
 assert.deepEqual(job.nativeClosingJobPosting,posting(closing.body))
 assert.deepEqual(job.nativeInventoryContext.heldNativeRecords,[{reason:'native-employer-name-unqualified',record:held}])
 assert.deepEqual(job.nativeInventoryContext.selectedNativeRecords,[good,held])
 assert.equal(io.calls.includes(unqualified.requestedUrl),false)
 assert.equal(io.calls.length,4)
 assert.equal(job.sourceDetailComplete,true)
 assert.equal(job.sourceScopeComplete,false)
 assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readSourceObservationEvidence(jobs,'fedex').observedRecordCount,2)
})

test('all missing-employer rows remain an unverified empty observation',async()=>{
 const io=replay({rows:[held]}),jobs=await run(options(io))
 assert.equal(jobs.length,0)
 assert.equal(io.calls.length,2)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.match(readInventoryEvidence(jobs).reason,/held-native-India-roles=1/)
})

test('held native facts still participate in the full closing listing comparison',async()=>{
 const io=replay({changeClosing:state=>{state.jobSearch.jobs[1].brandName='New employer declaration'}})
 await assert.rejects(run(options(io)),/closing native listing changed/)
})

test('a nonempty employer contradiction still fails rather than publishing the unqualified role',async()=>{
 const declared={...held,brandName:'Unqualified employer'}
 const io=replay({rows:[declared]})
 await assert.rejects(run(options(io)),/native employer changed/)
})

test('independent native role country contradictions remain fatal',async()=>{
 const io=replay({changeDetail:body=>{
  const changed=body.replace('"addressCountry":"IN"','"addressCountry":"US"')
  assert.notEqual(changed,body)
  return changed
 }})
 await assert.rejects(run(options(io)),/native role country is unresolved or contradictory/)
})

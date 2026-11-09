import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {inspectRetainedPackets} from './archivedDiagnostic.fixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261106.json.gz',import.meta.url))))
// Archived full-model controls; current registered failures have separate actual-route tests.
const replay=async(mutate=()=>{})=>inspectRetainedPackets(capture.packets,mutate,true)

test('current Snowplow native cohort and all eleven applications are inspected while stale corporate scope stays unknown',async()=>{
 const {jobs,evidence,audit}=await replay()
 assert.equal(jobs.length,0)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.notEqual(evidence.status,'verified-empty')
 assert.equal(audit.nativeInventoryCount,11)
 assert.deepEqual(audit.canonicalCountryCounts,{US:6,GB:5})
 assert.equal(audit.detailProofs.length,11)
 assert.ok(audit.detailProofs.every(p=>p.rawOpening&&p.rawClosing))
 assert.equal(audit.sourceScopeComplete,false)
 assert.match(audit.gaps.join(';'),/corporate\/native inventory identity mismatch/)
 assert.match(audit.gaps.join(';'),/unreconciled-native-role-reference/)
 assert.match(audit.gaps.join(';'),/unreviewed-declared-stylesheet/)
 assert.equal(readSourceObservationEvidence(jobs,'snowplow').observedVacancyCount,11)
})

test('current Snowplow changed role countries cannot borrow the reviewed foreign cohort proof',async()=>{
 const {evidence,audit}=await replay((response,url)=>{
  if(url.endsWith('/api/job-ad')){const data=JSON.parse(response.body);data.jobAdDetails[0].country='India';response.body=JSON.stringify(data)}
 })
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.indiaFacetCount,null)
 assert.ok(!audit.detailProofs.some(p=>p.rawClosing))
})

test('an unreviewed current Snowplow program remains an explicit native proof gap',async()=>{
 const {evidence,audit}=await replay((response,url)=>{if(url.includes('/runtime.'))response.body+='/*changed*/'})
 assert.equal(evidence.listingComplete,false)
 assert.match(audit.gaps.join(';'),/declared native renderer\/style\/program changed/)
})

test('a new corporate hiring program remains rejected before native reads',async()=>{
 const requests=[]
 await assert.rejects(run({fetchPage:async(url,init)=>{
  requests.push(url)
  const original=capture.packets.find(p=>p.requestUrl===url)
  return{status:200,url,contentType:original.contentType,body:original.body+'<script src="https://unknown.example/hiring.js"></script>'}
 }}),error=>error.code==='SNOWPLOW_NATIVE_INCOMPLETE'&&error.cause?.code==='SNOWPLOW_NATIVE_UNREVIEWED')
 assert.deepEqual(requests,['https://snowplow.io/careers'])
})

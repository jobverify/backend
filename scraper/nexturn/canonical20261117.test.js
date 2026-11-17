import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import {readNexTurnListing,readNexTurnDetail} from './currentNative.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/canonical-20261117.json.gz',import.meta.url))))
const spec={careersSignal:source.hasOfficialCareersSignal,cards:source.extractJobCards,detailSignal:source.hasOfficialJobDetailSignal,detail:source.extractJobDetail}
const careers=fixture.responses.find(packet=>packet.url===source.CAREERS_URL)
const rows=readNexTurnListing(spec,careers.body)
const selected=rows.find(row=>row.sourceUrl==='https://nexturn.com/job/net-technical-lead-with-kafka/')
const ownDetail=fixture.responses.find(packet=>packet.url===selected.sourceUrl).body

test('NexTurn current original canonical and literal India location variants retain36 full roles and two holds',async()=>{
 const counts=new Map(),requests=[]
 const jobs=await source.run({fetchImpl:async url=>{
  const count=counts.get(url)??0
  counts.set(url,count+1);requests.push(url)
  const packet=fixture.responses.filter(packet=>packet.url===url)[count]
  assert.ok(packet,'No undeclared NexTurn reads')
  assert.equal(url,packet.url)
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url})
  return response
 }})
 assert.equal(requests.length,76)
 assert.equal(jobs.length,36)
 assert.equal(new Set(jobs.map(job=>job.sourceNativeJobId)).size,36)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceClosingReconciled))
 assert.ok(jobs.some(job=>job.sourceNativeCanonical==='https://172.26.11.116/job/net-technical-lead-with-kafka/'))
 assert.equal(jobs.nativeCollectionEvidence.openingClosingListingMatch,true)
 const assessment=assessSoftFailureAcquisition({source:'nexturn',companyName:'NexTurn'},jobs)
 assert.equal(assessment.runnerOutcome.rawRecords,38)
 assert.equal(assessment.indiaJobs,36)
 assert.equal(jobs.nativeCollectionEvidence.holds.length,2)
 assert.ok(jobs.nativeCollectionEvidence.holds.some(row=>row.url==='https://nexturn.com/job/servicenow-product-manager/'&&row.reason==='native-country-unqualified'))
 assert.ok(jobs.nativeCollectionEvidence.holds.some(row=>row.url==='https://nexturn.com/job/sr-software-engineer-plm-platform/'&&row.reason==='native-foreign-country'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const [name,edit]of [
 ['unreviewed private address',html=>html.replace('https://172.26.11.116/job/net-technical-lead-with-kafka/','https://172.26.11.117/job/net-technical-lead-with-kafka/')],
 ['reviewed private address with another role path',html=>html.replace('https://172.26.11.116/job/net-technical-lead-with-kafka/','https://172.26.11.116/job/websmart-developer/')],
 ['own native role ID contradiction',html=>html.replace(/(rel=shortlink href=)[^ >]+/,'$1https://nexturn.com/?p=99999999')],
 ['another role heading',html=>html.replace('<h1 class="section-title">','. <h1 class="section-title">Another role ')],
])test('NexTurn finite canonical alias rejects '+name,()=>{
 const changed=edit(ownDetail)
 assert.notEqual(changed,ownDetail)
 assert.throws(()=>readNexTurnDetail(spec,changed,selected),/native|criteria/i)
})

test('NexTurn private canonical metadata is limited to its reviewed native role identities',()=>{
 const row=rows[0],original=fixture.responses.find(packet=>packet.url===row.sourceUrl).body
 const changed=original.replace('rel=canonical href=https://nexturn.com/','rel=canonical href=https://172.26.11.116/')
 assert.notEqual(changed,original)
 assert.throws(()=>readNexTurnDetail(spec,changed,row),/canonical/i)
})

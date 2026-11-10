import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createNativeLyraScraper} from './native.js'
import {API,HOST,hash,readNativeRole} from './nativeRole.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {extractionRawJobMetrics} from '../../scraper-support/utils/extractionRawJobMetrics.js'

const captured=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-public-responses.json.gz',import.meta.url))))
const pages=new Map(captured.responses.map(packet=>[packet.requestUrl,packet]))
const openingPages=captured.responses.filter(packet=>packet.requestUrl.startsWith(API)).slice(0,10)
const records=openingPages.flatMap(packet=>JSON.parse(packet.body))
const india=records.filter(record=>record.country==='IN')
const clock='2026-11-10T02:39:14.332Z'
const replay=(change=packet=>packet)=>async url=>{
 const original=pages.get(url)
 assert.ok(original,'Unexpected live request in offline regression: '+url)
 const packet=change({...original})
 const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
 Object.defineProperty(response,'url',{value:packet.finalUrl})
 return response
}

test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected network in captured Lyra tests')}))

test('current complete Lyra native roles retain their descriptions and typed India geography after the style deployment',()=>{
 assert.equal(records.length,479)
 assert.equal(india.length,7)
 for(const row of india){
  const packet=pages.get(row.hostedUrl)
  assert.equal(packet.status,200)
  assert.equal(hash(packet.body),packet.sha256)
  const job=readNativeRole(row,packet.body,clock)
  assert.equal(job.jobId,row.id)
  assert.equal(job.country,'India')
  assert.equal(job.title,row.text)
  assert.ok(job.jobDescription.length>100)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
})

test('current Lyra factory reconciles both native inventories and all seven own role pages',async()=>{
 let audit
 const jobs=await createNativeLyraScraper().run({fetchImpl:replay(),minIntervalMs:0,now:clock,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,7)
 assert.equal(audit.nativeInventoryClosingReconciled,true)
 assert.equal(audit.nativeRoleClosingReconciled,7)
 assert.deepEqual(audit.heldNativeRows,[])
 assert.ok(jobs.every(job=>job.sourceDetailComplete&&job.nativeRoleClosingReconciled))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(job=>job.lifecycleCleanupAllowed===false))
})

for(const[name,change]of[
 ['unreviewed stylesheet bytes',html=>html.replace('#colour-refresh-2026 {font: inherit;}','#colour-refresh-2026 {display: none;}')],
 ['an added stylesheet',html=>html.replace('</head>','<style>.posting-requirements{display:none}</style></head>')],
 ['foreign publisher identity',html=>html.replace(/"name"\s*:\s*"Lyra Health"/,'"name":"Different Employer"')],
])test('Lyra style repair continues to reject '+name,()=>{
 const row=india[0],html=pages.get(row.hostedUrl).body,changed=change(html)
 assert.ok(changed!==html,'The negative control must change the original response')
 assert.throws(()=>readNativeRole(row,changed,clock),/Lyra native/)
})

test('Lyra does not export roles when their closing native criteria change',async()=>{
 const target=india[0],counts=new Map()
 const fetchImpl=replay(packet=>{
  if(!packet.requestUrl.startsWith(API))return packet
  const count=(counts.get(packet.requestUrl)||0)+1;counts.set(packet.requestUrl,count)
  if(count<2)return packet
  const rows=JSON.parse(packet.body)
  const row=rows.find(row=>row.id===target.id)
  if(row)row.text+=' (changed during collection)'
  return{...packet,body:JSON.stringify(rows)}
 })
 const jobs=await createNativeLyraScraper().run({fetchImpl,minIntervalMs:0,now:clock})
 assert.equal(jobs.length,6)
 assert.ok(jobs.every(job=>job.jobId!==target.id&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Lyra retains native vacancy observations and the hold reason when every India role is held',async()=>{
 const jobs=await createNativeLyraScraper().run({minIntervalMs:0,now:clock,fetchImpl:replay(packet=>{
  if(!packet.requestUrl.startsWith(HOST))return packet
  return{...packet,body:packet.body.replace('#colour-refresh-2026 {font: inherit;}','#colour-refresh-2026 {display:none;}')}
 })})
 assert.equal(jobs.length,0)
 const observations=readSourceObservationEvidence(jobs,'lyrahealth'),evidence=readInventoryEvidence(jobs)
 assert.equal(observations?.observedVacancyCount,479)
 assert.equal(observations?.sourceScopeComplete,false)
 assert.deepEqual(extractionRawJobMetrics({source:'lyrahealth'},jobs,evidence),{
  rawJobs:479,rawJobsBasis:'observed-native-vacancy-rows',
 })
 assert.match(evidence.reason,/held-native-roles=7/)
 assert.match(evidence.reason,/unreviewed own stylesheet contract/)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.reportedTotal,null)
})

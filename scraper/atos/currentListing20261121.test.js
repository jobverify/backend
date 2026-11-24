import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'

const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-listing-20261120.json.gz',import.meta.url))))
const reviewedRows=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-role-rows-20261121.json.gz',import.meta.url))))
const selected=current.packets.at(-1).requestedURL
async function replay(t,change){
 const counts=new Map(),calls=[]
 t.mock.method(globalThis,'fetch',()=>{throw Error('No live network in selected-listing regression')})
 const jobs=await run({now:()=>current.capturedAt,requestIntervalMs:0,fetchImpl:async value=>{
  const url=String(value),index=counts.get(url)??0;counts.set(url,index+1);calls.push(url)
  const newlyReviewed=reviewedRows.reviewedNewRows.slice(0,2).some(row=>row.url===url)
  const packet=newlyReviewed?reviewedRows.packets.filter(row=>row.requestedURL===url)[index]:current.packets.find(row=>row.requestedURL===url)??historical.packets.filter(row=>row.requestedURL===url)[index]
  assert.ok(packet,'Only retained original declared native packets are available: '+url)
  let body=Buffer.from(packet.bodyBase64,'base64').toString()
  if(url===selected&&change){const altered=change(body);assert.notEqual(altered,body);body=altered}
  const response=new Response(Buffer.from(body),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 return{jobs,calls}
}

test('current original20-row India listing recovers reviewed roles and holds new native role contracts',async t=>{
 const{jobs,calls}=await replay(t)
 assert.ok(jobs.length>0)
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,20)
 assert.equal(jobs.nativeCollectionEvidence.unqualifiedNativeRowCount,1)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.ok(calls.includes('https://jobs.atos.net/job/Mumbai-LEAD-CONSULTANT/1459169833/'))
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.ok(job.sourceNativeFullCriteria.length>=500)}
})

for(const[name,change]of[
 ['unknown executable outside the native rows',html=>html.replace('</head>','<script>window.unreviewedNativeControl=true</script></head>')],
 ['unknown executable inside a native row',html=>html.replace('<tr class="data-row">','<tr class="data-row"><script>window.unreviewedNativeControl=true</script>')],
 ['foreign native row work country',html=>html.replaceAll('Mumbai, IN','Mumbai, ID')],
 ['unknown row event/schema',html=>html.replace('<tr class="data-row">','<tr class="data-row" onclick="unreviewed()">')],
 ['conflicting terminal count',html=>html.replace('Results <b>1 – 20</b> of <b>20</b>','Results <b>1 – 20</b> of <b>21</b>')],
 ['duplicate native row identity',html=>html.replaceAll('/job/Bangalore-CGO-Account-Sales-Executive/1448466833/','/job/Mumbai-LEAD-CONSULTANT/1459169833/')],
])test('current listing projection rejects '+name,async t=>{
 await assert.rejects(replay(t,change),/Atos current native/)
})

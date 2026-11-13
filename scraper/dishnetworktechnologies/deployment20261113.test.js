import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=name=>gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/'+name+'.gz',import.meta.url))).toString('utf8')
const current='https://app.jibecdn.com/prod/search/4.11.226/main.js'
const manifest=JSON.parse(readFileSync(new URL('./fixtures/manifest-20261111.json',import.meta.url),'utf8'))
const packets=new Map(manifest.receipts.map(row=>[row.requestedURL,{body:gunzipSync(readFileSync(new URL('./fixtures/'+row.fixture,import.meta.url))),type:row.headers['content-type']}]))
const search=manifest.receipts.find(row=>row.fixture==='native-search-20261111.gz').requestedURL
packets.set(search,{body:fixture('search'),type:'text/html'})
packets.set(current,{body:fixture('client'),type:'application/javascript'})
async function replay(change=packet=>packet){
 const calls=[],counts=new Map()
 const jobs=await run({fetchImpl:async url=>{
  const packet=packets.get(url);assert.ok(packet,'uncaptured URL '+url);calls.push(url)
  const occurrence=(counts.get(url)||0)+1;counts.set(url,occurrence)
  const changed=change({url,occurrence,...packet}),response=new Response(changed.body,{headers:{'content-type':changed.type}})
  Object.defineProperty(response,'url',{value:url});return response
 }})
 return{jobs,calls}
}
test('November 13 EchoStar renderer preserves the captured four India full native roles with company scope held',async()=>{
 const{jobs,calls}=await replay()
 assert.deepEqual(jobs.map(job=>job.jobId),['98606','97540','95713','97514'])
 assert.ok(jobs.every(job=>job.sourceDetailComplete&&job.country==='India'&&job.sourceScopeComplete===false))
 assert.equal(calls.filter(url=>url===current).length,2)
})
const api=manifest.receipts.find(row=>row.fixture==='native-api-page-1-20261111.gz').requestedURL
const actualInventory=change=>packet=>packet.url===api?{...packet,body:change(fixture(packet.occurrence===1?'opening-api':'closing-api'),packet.occurrence)}:packet
test('actual EchoStar closing full inventory tolerates only its reviewed coarse-versus-fractional last-modification representation',async()=>{
 const{jobs}=await replay(actualInventory(body=>body))
 assert.equal(jobs.length,4)
 assert.equal(jobs[0].nativeListingRecord.data.meta_data.last_mod,'2026-10-22T21:47:18+0000')
 assert.equal(jobs[0].nativeCollectionEvidence.lastModificationRepresentationDifferences.length,10)
})
test('EchoStar modification metadata changing its whole second still rejects the closing inventory',async()=>{
 await assert.rejects(replay(actualInventory((body,occurrence)=>occurrence===2?body.replace('2026-10-22T21:47:18.466+00:00','2026-10-22T21:47:19.466+00:00'):body)),/closing.*inventory/)
})
test('EchoStar two distinct fractional modification instants within one second still reject the inventory',async()=>{
 await assert.rejects(replay(actualInventory((body,occurrence)=>occurrence===1?body.replaceAll('2026-10-22T21:47:18+0000','2026-10-22T21:47:18.465+00:00'):body)),/closing.*inventory/)
})
test('November 13 EchoStar still rejects changed renderer bytes before native vacancy reads',async()=>{
 await assert.rejects(replay(packet=>packet.url===current?{...packet,body:packet.body+'/* changed */'}:packet),/renderer|client/)
})

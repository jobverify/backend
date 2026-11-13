import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runCurrentFirstCitizensInventory} from './currentNative20261111.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=name=>gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/'+name+'.gz',import.meta.url))).toString('utf8')
const current='https://app.jibecdn.com/prod/search/4.11.226/main.js'
const manifest=JSON.parse(readFileSync(new URL('./fixtures/manifest-20261111.json',import.meta.url),'utf8'))
const packets=new Map(manifest.receipts.map(row=>[row.requestedURL,{body:gunzipSync(readFileSync(new URL('./fixtures/'+row.fixture,import.meta.url))),type:row.headers['content-type']}]))
packets.set('https://jobs.firstcitizens.com/jobs',{body:fixture('search'),type:'text/html'})
packets.set(current,{body:fixture('client'),type:'application/javascript'})
async function replay(change=packet=>packet){
 const calls=[];let audit
 const jobs=await runCurrentFirstCitizensInventory({onAudit:value=>{audit=value},fetchImpl:async url=>{
  const packet=packets.get(url);assert.ok(packet,'uncaptured URL '+url);calls.push(url)
  const changed=change({url,...packet}),response=new Response(changed.body,{headers:{'content-type':changed.type}})
  Object.defineProperty(response,'url',{value:url});return response
 }})
 return{jobs,calls,audit}
}
test('November 13 First Citizens renderer preserves exhaustive native country checks before certifying the captured configured India zero',async()=>{
 const{jobs,calls,audit}=await replay()
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
 assert.equal(audit.nativeListingRecords.length,404)
 assert.equal(calls.filter(url=>url===current).length,2)
})
test('November 13 First Citizens still rejects a changed renderer before any native country search',async()=>{
 await assert.rejects(replay(packet=>packet.url===current?{...packet,body:packet.body+'/* changed */'}:packet),/renderer|client/)
})

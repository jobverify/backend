import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCurrentSnowplowScraper} from './currentNative.js'
import {typographyAlias,typographyTarget,typographyPacket} from './typography20261110.fixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/snowplow20261110-current-deployment.json.gz',import.meta.url))))
const archive=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/declared-build-20261109.json.gz',import.meta.url))))
const originalBytes=new Map(archive.packets.map(packet=>[createHash('sha256').update(packet.body).digest('hex'),packet]))
for(const packet of capture.packets)if(packet.duplicateOriginalBodySha256){
 const original=originalBytes.get(packet.duplicateOriginalBodySha256)
 assert.ok(original,'Captured current body must match a retained complete original')
 assert.equal(packet.sha256,packet.duplicateOriginalBodySha256)
 packet.body=original.body;packet.rawBodyBase64=original.rawBodyBase64
}
const packets=new Map(capture.packets.map(packet=>[packet.requestedURL,packet]))
async function replay(mutate=()=>{}){
 const calls=[];let audit
 const jobs=await createCurrentSnowplowScraper().run({onAudit:value=>{audit=value},fetchPage:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const original=url===typographyAlias?typographyPacket('browser'):url===typographyTarget?typographyPacket('target'):packets.get(url)
  assert.ok(original,'Only retained original public endpoints: '+url)
  if(original.rawBodyBase64||original.rawBodyReencodedFromLosslessUtf8){const bytes=original.rawBodyBase64?Buffer.from(original.rawBodyBase64,'base64'):Buffer.from(original.body,'utf8');assert.equal(createHash('sha256').update(bytes).digest('hex'),original.sha256);assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(bytes),original.body)}
  const packet=structuredClone(original);mutate(packet,url,calls);calls.push(url);return packet
 }})
 return{jobs,audit,calls,evidence:readInventoryEvidence(jobs)}
}

test('reviewed November 10 deployment retains ten native observations and unresolved corporate/country evidence',async()=>{
 const {jobs,audit,evidence,calls}=await replay()
 assert.equal(audit.nativeInventoryCount,10)
 assert.equal(audit.reviewedNativeRecordCount,10)
 assert.equal(audit.unreviewedNativeRecordCount,0)
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'snowplow').observedRecordCount,10)
 assert.match(audit.gaps.join(';'),/corporate\/native inventory identity mismatch/)
 assert.match(audit.gaps.join(';'),/unreconciled-native-role-reference/)
 assert.match(audit.gaps.join(';'),/native-posting-country-disagreement:1b29b2e2-8fa7-431f-948d-060d8ec1fe33/)
 assert.equal(audit.gaps.some(gap=>gap.startsWith('unreviewed-declared-stylesheet:')),false)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.cleanupAllowed,false)
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false})
 assert.equal(calls.filter(url=>url.includes('/main.86790cb31de360bc.js')).length,2)
})

for(const [name,mutate]of[
 ['changed main program',(packet,url)=>{if(url.includes('/main.86790cb31de360bc.js'))packet.body+=';window.unreviewed=true'}],
 ['changed secondary chunk',(packet,url)=>{if(url.includes('/686.5cfaaed6ca7bb42c.js'))packet.body+=';window.unreviewed=true'}],
 ['closing runtime drift',(packet,url,calls)=>{if(url.includes('/runtime.20b1318e60d1ef1d.js')&&calls.includes(url))packet.body+=';window.unreviewed=true'}],
])test('November 10 deployment rejects '+name+' without cleanup',async()=>{
 await assert.rejects(replay(mutate),error=>{
  assert.match(error.message,/renderer\/style\/program changed/)
  assert.equal(error.nativeEvidence.sourceScopeComplete,false);assert.equal(error.nativeEvidence.cleanupAllowed,false)
  assert.equal(error.inventoryEvidence.listingComplete,false);assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  return true
 })
})

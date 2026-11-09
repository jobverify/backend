import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {inspectRetainedPackets} from './archivedDiagnostic.fixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261106-evening.json.gz',import.meta.url))))
const source=createCatalogScraper(getScraperCatalog().find(p=>p.source==='snowplow'))
// Archived model mutations use data-only diagnostics; primary activation cases retain the registered path.
const replay=async(mutate=()=>{})=>inspectRetainedPackets(capture.packets,mutate,true)
const replaySource=async(mutate=()=>{})=>{
 let audit
 const calls=[]
 const jobs=await source.run({fetchPage:async(url,init)=>{
  const packet=capture.packets.find(p=>p.requestUrl===url)
  assert.ok(packet,'only genuinely captured declared endpoints: '+url)
  assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
  const response={status:packet.status,url:packet.url,contentType:packet.contentType,body:packet.body}
  mutate(response,url,calls)
  calls.push(url)
  return response
 },onAudit:value=>{audit=value}})
 return{jobs,evidence:readInventoryEvidence(jobs),audit,calls}
}
test('archived current evening HiBob diagnostic inspects all11 native roles and applications without claiming company scope',async()=>{
 const {jobs,evidence,audit,calls}=await replay()
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeInventoryCount,11)
 assert.deepEqual(audit.canonicalCountryCounts,{US:6,GB:5})
 assert.equal(audit.detailProofs.length,11)
 assert.ok(audit.detailProofs.every(p=>p.rawOpening&&p.rawClosing))
 assert.ok(audit.rawOpeningFeed&&audit.rawClosingFeed)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.notEqual(evidence.status,'verified-empty')
 assert.match(audit.gaps.join(';'),/corporate\/native inventory identity mismatch/)
 assert.match(audit.gaps.join(';'),/unreconciled-native-role-reference/)
 assert.match(audit.gaps.join(';'),/unreviewed-declared-stylesheet/)
 assert.equal(readSourceObservationEvidence(jobs,'snowplow').observedVacancyCount,11)
 assert.ok(calls.filter(url=>url.includes('/runtime.')).length===2)
})
for(const [label,mutate]of[
 ['changed module activation',(r,url)=>{if(url==='https://snowplow.careers.hibob.com/')r.body=r.body.replace('type="module"','type="text/plain"')}],
 ['unknown employer program',(r,url)=>{if(url==='https://snowplow.io/careers')r.body+='<script src="https://unknown.example/jobs.js"></script>'}],
 ['unreviewed board deployment',(r,url)=>{if(url==='https://snowplow.careers.hibob.com/')r.body=r.body.replace('master-ff248bbc','master-00112233')}],
])test(label+' remains rejected before native API reads',async()=>{
 await assert.rejects(replaySource(mutate),e=>e.code==='SNOWPLOW_NATIVE_INCOMPLETE'&&e.cause?.code==='SNOWPLOW_NATIVE_UNREVIEWED')
})
for(const [label,mutate,reason]of[
 ['marketing posting location alternatives',(r,url)=>{if(url.endsWith('/api/job-ad')){const p=JSON.parse(r.body);p.jobAdDetails[0].postingLocations=[{country:'India',region:'',city:''}];r.body=JSON.stringify(p)}},/posting location alternatives/],
 ['new typed country',(r,url)=>{if(url.endsWith('/api/job-ad')){const p=JSON.parse(r.body);p.jobAdDetails[0].country='India';r.body=JSON.stringify(p)}},/complete native role criteria/],
 ['changed lazy location program',(r,url)=>{if(url.includes('/4520.'))r.body+='/* unreviewed */'},/declared native renderer\/style\/program changed/],
 ['changed closing application criteria',(r,url,calls)=>{if(url.endsWith('/application-form')&&calls.includes(url)){const p=JSON.parse(r.body);p.metadata.changed=true;r.body=JSON.stringify(p)}},/nested application metadata/],
 ['changed closing full feed',(r,url,calls)=>{if(url.endsWith('/api/job-ad')&&calls.filter(u=>u===url).length>=2){const p=JSON.parse(r.body);p.jobAdDetails[0].title+=' changed';r.body=JSON.stringify(p)}},/full raw closing cohort\/criteria changed/],
])test(label+' keeps current native proof incomplete',async()=>{
 const{evidence,audit}=await replay(mutate)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.indiaFacetCount,null)
 assert.notEqual(evidence.status,'verified-empty')
 assert.match(audit.gaps.join(';'),reason)
})

test('registered reviewed corporate mismatch retains every native role and both criteria passes with unknown company inventory',async()=>{
 const {jobs,evidence,audit,calls}=await replaySource()
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeInventoryCount,11)
 assert.deepEqual(audit.canonicalCountryCounts,{US:6,GB:5})
 assert.equal(audit.detailProofs.length,11)
 assert.ok(audit.detailProofs.every(p=>p.rawOpening&&p.rawClosing))
 assert.ok(audit.rawOpeningFeed&&audit.rawClosingFeed)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.cleanupAllowed,false)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.notEqual(evidence.status,'verified-empty')
 assert.match(audit.gaps.join(';'),/corporate\/native inventory identity mismatch/)
 assert.match(audit.gaps.join(';'),/unreconciled-native-role-reference/)
 assert.match(audit.gaps.join(';'),/unreviewed-declared-stylesheet/)
 assert.equal(readSourceObservationEvidence(jobs,'snowplow').observedVacancyCount,11)
 assert.equal(calls.filter(url=>url.includes('/runtime.')).length,2)
})

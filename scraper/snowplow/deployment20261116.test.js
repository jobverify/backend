import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCurrentSnowplowScraper} from './currentNative.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/deployment-20261116.json.gz',import.meta.url))))
async function replay(mutate=()=>{}){
 const calls=[];let audit
 const jobs=await createCurrentSnowplowScraper().run({fetchPage:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const original=capture.packets.find(p=>p.requestUrl===url)
  assert.ok(original,'Only retained public endpoint: '+url)
  const response={...structuredClone(original),bodyComplete:true}
  mutate(response,url,calls.filter(value=>value===url).length+1);calls.push(url)
  return response
 },onAudit:value=>{audit=value}})
 return{jobs,audit,calls,evidence:readInventoryEvidence(jobs)}
}

test('November16 Snowplow deployment retains ten full native observations without inventing India zero or cleanup',async()=>{
 const{jobs,audit,evidence}=await replay()
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeInventoryCount,10)
 assert.equal(audit.reviewedNativeRecordCount,10)
 assert.equal(audit.unreviewedNativeRecordCount,0)
 assert.equal(readSourceObservationEvidence(jobs,'snowplow').observedRecordCount,10)
 assert.ok(audit.gaps.includes('native-posting-country-disagreement:1b29b2e2-8fa7-431f-948d-060d8ec1fe33'))
 assert.ok(audit.gaps.includes('current-native-renderer-complete-scope-unverified'))
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false})
})

for(const[name,mutate]of[
 ['unreviewed employer markup',(p,u)=>{if(u==='https://snowplow.io/careers')p.body=p.body.replace('</head>','<style>#rlist{display:none}</style></head>')}],
 ['changed native program',(p,u)=>{if(u.includes('/main.e982'))p.body+=';window.unreviewed=true'}],
 ['changed closing chunk',(p,u,n)=>{if(u.includes('/3213.')&&n===2)p.body+=';window.unreviewed=true'}],
])test('November16 Snowplow rejects '+name+' and preserves inventory',async()=>{
 await assert.rejects(replay(mutate),error=>{
  assert.match(error.message,/unreviewed complete raw|renderer\/style\/program changed/)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.nativeEvidence.cleanupAllowed,false)
  return true
 })
})

test('November16 Snowplow does not qualify changed raw native criteria with archived proof',async()=>{
 const{audit,evidence}=await replay((p,u)=>{if(u.endsWith('/api/job-ad')){const value=JSON.parse(p.body);value.jobAdDetails[0].description+='<p>Must have additional clearance.</p>';p.body=JSON.stringify(value)}})
 assert.equal(audit.reviewedNativeRecordCount,9)
 assert.equal(audit.unreviewedNativeRecordCount,1)
 assert.equal(evidence.listingComplete,false)
 assert.ok(audit.gaps.some(gap=>gap.startsWith('unreviewed-complete-native-role-criteria:')))
})

import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const native=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-20261116.json.gz',import.meta.url))))
async function replay(change=()=>{}){
 const counts=new Map()
 const jobs=await run({requestIntervalMs:0,now:()=>current.capturedAt,fetchImpl:async(value)=>{
  const url=String(value),visit=counts.get(url)??0;counts.set(url,visit+1)
  const original=current.packets.filter(p=>p.requestedURL===url)[visit]??(visit===0?native.opening:native.closing).find(p=>p.requestedURL===url)??native.assets.find(p=>p.requestedURL===url)
  assert.ok(original,'Only original reviewed public endpoints: '+url)
  const packet=structuredClone(original);change(packet,url,visit)
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 return jobs
}
const body=(p,change)=>{p.bodyBase64=Buffer.from(change(Buffer.from(p.bodyBase64,'base64').toString('utf8'))).toString('base64')}
test('November16 exact Hiver corporate cache variant retains one full typedIndia role and eleven holds',async()=>{
 const jobs=await replay()
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'607644');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs.nativeCollectionEvidence.opening.rows.length,12);assert.equal(jobs.nativeCollectionEvidence.opening.held.length,11)
 assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const[name,change]of[
 ['changed corporate CSP',(p,u)=>{if(u==='https://hiverhq.com/careers')p.headers['content-security-policy']="default-src 'none'"}],
 ['foreign native country',(p,u)=>{if(u.includes('/en/postings/'))body(p,h=>h.replace('"addressCountry":"IN"','"addressCountry":"US"'))}],
])test('November16 Hiver preserves rejection of '+name,async()=>{await assert.rejects(replay(change),/Hiver current native:/)})

for(const[name,change]of[
 ['unused corporate marker script',(p,u)=>{if(u==='https://hiverhq.com/careers')body(p,h=>h.replace('</head>','<script>window.unreviewed=true</script></head>'))}],
 ['bounded anonymous cache age',(p,u,n)=>{if(u==='https://hiverhq.com/careers'&&n===1)p.headers['cache-control']='max-age=292, must-revalidate'}],
])test('November16 Hiver treats '+name+' as provenance',async()=>{const jobs=await replay(change);assert.equal(jobs.length,1);assert.equal(jobs[0].sourceRenderedFullCriteriaQualified,false)})

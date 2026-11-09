import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const read=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/'+name,import.meta.url))))
const assets=read('declared-build-20261109.json.gz'),corporate=read('corporate-chrome-20261109.json.gz').packet
const board=read('unreviewed-board-20261109.json.gz').packet.response,archive=read('current-native-20261106-evening.json.gz')
const assetMap=new Map(assets.packets.map(p=>[p.requestedURL,p])),oldMap=new Map(archive.packets.map(p=>[p.requestUrl,p]))
const corporateURL='https://snowplow.io/careers',boardURL='https://snowplow.careers.hibob.com/'
const currentBuild='master-ca5a2f0db82396c349fbcfb3addf624abaeca12b',oldBuild='master-ff248bbc481be0bf119e8568a0f5c490d6aa1577'
const source=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='snowplow'))
for(const packet of assets.packets){assert.equal(packet.bodyComplete,true);assert.equal(sha(packet.body),packet.bodySHA256);assert.equal(sha(Buffer.from(packet.rawBodyBase64,'base64')),packet.bodySHA256)}

test('all92 literal current resources reconstruct full reviewed behavior with only the observed deployment identity differences',()=>{
 const review=JSON.parse(fs.readFileSync(new URL('./reviewedNative20261106Evening.json',import.meta.url)))
 assert.equal(assetMap.size,92)
 let unchanged=0,changed=0
 const replace=(body,from,to,count)=>{assert.equal(body.split(from).length-1,count);return body.replaceAll(from,to)}
 let oldBoard=replace(board.body,currentBuild,oldBuild,5)
 oldBoard=replace(oldBoard,'runtime.f4b99bac6c49fcce.js','runtime.1a1d839159fe0484.js',1)
 oldBoard=replace(oldBoard,'main.20067ce59282d294.js','main.81fe083ec4eabe33.js',1)
 assert.equal(oldBoard,oldMap.get(boardURL).body)
 for(const resource of review.resources.filter(r=>r.url.includes(oldBuild))){
  const url=resource.url.replace(oldBuild,currentBuild).replace('runtime.1a1d839159fe0484.js','runtime.f4b99bac6c49fcce.js').replace('main.81fe083ec4eabe33.js','main.20067ce59282d294.js')
  const packet=assetMap.get(url),previous=oldMap.get(resource.url)
  assert.ok(packet&&previous)
  assert.equal(packet.status,200);assert.equal(packet.url,url);assert.equal(packet.contentType,resource.contentType)
  if(packet.body===previous.body){unchanged++;continue}
  let reconstructed
  if(url.includes('/runtime.')||url.includes('/main.'))reconstructed=replace(packet.body,currentBuild,oldBuild,1)
  else{
   assert.ok(url.endsWith('/deployment-info.js'))
   const pattern=/(const deploymentInfoJsonStr = `)([\s\S]*?)(`;)/g
   const a=[...previous.body.matchAll(pattern)],b=[...packet.body.matchAll(pattern)]
   assert.equal(a.length,1);assert.equal(b.length,1)
   const before=JSON.parse(a[0][2]),after=JSON.parse(b[0][2])
   assert.deepEqual(Object.keys(after),['apps','deploymentVersion'])
   assert.deepEqual(Object.keys(after.apps),Object.keys(before.apps));assert.equal(Object.keys(after.apps).length,23)
   assert.equal(after.deploymentVersion,currentBuild);assert.equal(after.apps.careers.version,currentBuild)
   for(const app of Object.values(after.apps)){assert.deepEqual(Object.keys(app),['version']);assert.match(app.version,/^master-[a-f\d]{40}$/)}
   reconstructed=packet.body.replace(b[0][0],a[0][0])
  }
  assert.equal(reconstructed,previous.body)
  changed++
 }
 assert.equal(unchanged,89);assert.equal(changed,3)
})

// Only the corporate/board/assets are current originals. Native feed/form and
// external stylesheet packets are explicitly retained Nov6 controls here.
async function replay(mutate=()=>{},options={}){
 let audit
 const calls=[]
 const jobs=await source().run({onAudit:value=>{audit=value},fetchPage:async url=>{
  const packet=url===corporateURL?{...corporate,url:corporate.finalUrl}:url===boardURL?board:assetMap.get(url)||oldMap.get(url)
  assert.ok(packet,'Only literally declared captured endpoints: '+url)
  const response={status:packet.status,url:packet.url,contentType:packet.contentType,body:packet.body}
  mutate(response,url,calls)
  calls.push(url)
  return response
 },...options})
 return{jobs,audit,calls,evidence:readInventoryEvidence(jobs)}
}

test('paired current deployment and retained native criteria preserve all eleven foreign observations and unknown company scope',async()=>{
 const{jobs,audit,calls,evidence}=await replay()
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeInventoryCount,11)
 assert.deepEqual(audit.canonicalCountryCounts,{US:6,GB:5})
 assert.equal(audit.detailProofs.length,11)
 assert.ok(audit.detailProofs.every(p=>p.rawOpening&&p.rawClosing))
 assert.ok(calls.filter(url=>url.includes(currentBuild)).length>=184)
 assert.equal(calls.some(url=>url.includes(oldBuild)),false)
 assert.match(audit.gaps.join(';'),/corporate\/native inventory identity mismatch/)
 assert.match(audit.gaps.join(';'),/unreconciled-native-role-reference/)
 assert.match(audit.gaps.join(';'),/unreviewed-declared-stylesheet/)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.cleanupAllowed,false)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.notEqual(evidence.status,'verified-empty')
 assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false})
})

test('reviewed current board admits no API request beyond a caller request cap',async()=>{
 await assert.rejects(replay(undefined,{maxRequests:2}),error=>{
  assert.equal(error.code,'SNOWPLOW_REQUEST_BUDGET')
  assert.equal(error.nativeEvidence.requestCount,2)
  assert.deepEqual(error.nativeEvidence.attempts.map(r=>r.url),[corporateURL,boardURL])
  assert.equal(error.inventoryEvidence.listingComplete,false)
  return true
 })
})

for(const[label,mutate,reason]of[
 ['old runtime under current declared URL',(r,url)=>{if(url.includes('/runtime.f4b99bac6c49fcce.js'))r.body=oldMap.get('https://front.hibob.com/'+oldBuild+'/careers/runtime.1a1d839159fe0484.js').body},/renderer\/style\/program changed/],
 ['old main under current declared URL',(r,url)=>{if(url.includes('/main.20067ce59282d294.js'))r.body=oldMap.get('https://front.hibob.com/'+oldBuild+'/careers/main.81fe083ec4eabe33.js').body},/renderer\/style\/program changed/],
 ['changed runtime chunk manifest',(r,url)=>{if(url.includes('/runtime.'))r.body=r.body.replace('3504757023f1ed56','0000000000000000')},/renderer\/style\/program changed/],
 ['changed main application program',(r,url)=>{if(url.includes('/main.'))r.body+=';/* unreviewed native behavior */'},/renderer\/style\/program changed/],
 ['changed metadata app scope',(r,url)=>{if(url.endsWith('/deployment-info.js'))r.body=r.body.replace('"apps": {','"apps": { "careers-india": {"version":"'+currentBuild+'"},')},/renderer\/style\/program changed/],
 ['changed metadata executable suffix',(r,url)=>{if(url.endsWith('/deployment-info.js'))r.body+=';unknownHiringControl()'},/renderer\/style\/program changed/],
 ['changed current stylesheet',(r,url)=>{if(url.includes('/styles.'))r.body+='body{display:none}'},/renderer\/style\/program changed/],
 ['changed current lazy program',(r,url)=>{if(url.includes('/3213.'))r.body+=';unknownHiringControl()'},/renderer\/style\/program changed/],
 ['conflicting native country',(r,url)=>{if(url.endsWith('/api/job-ad')){const p=JSON.parse(r.body);p.jobAdDetails[0].country='India';r.body=JSON.stringify(p)}},/role\/application identity conflict/],
 ['additional native India location',(r,url)=>{if(url.endsWith('/api/job-ad')){const p=JSON.parse(r.body);p.jobAdDetails[0].postingLocations=[{country:'India',city:'Bengaluru'}];r.body=JSON.stringify(p)}},/posting location alternatives/],
 ['changed native filter scope',(r,url)=>{if(url.endsWith('/api/job-ad')){const p=JSON.parse(r.body);p.jobOpeningMetadata[0].unknownHiringScope='India';r.body=JSON.stringify(p)}},/filter\/opening metadata/],
 ['changed closing mandatory application criteria',(r,url,calls)=>{if(url.endsWith('/application-form')&&calls.includes(url)){const p=JSON.parse(r.body);p.metadata.unknownMandatoryQualification=true;r.body=JSON.stringify(p)}},/nested application metadata/],
])test('paired deployment rejects '+label+' and cannot certify zero or cleanup',async()=>{
 await assert.rejects(replay(mutate),error=>{
  assert.match(error.message,reason)
  assert.equal(error.nativeEvidence.sourceScopeComplete,false)
  assert.equal(error.nativeEvidence.cleanupAllowed,false)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  return true
 })
})

test('paired deployment keeps the previous complete role and unresolved-scope contracts unchanged',()=>{
 const oldReview=JSON.parse(fs.readFileSync(new URL('./reviewedNative20261106Evening.json',import.meta.url)))
 const review=JSON.parse(fs.readFileSync(new URL('./reviewedNative20261109.json',import.meta.url)))
 for(const key of ['siteCanonicalSha256','feedScopeSha256','supplementedBaseEngineGaps','preservedBaseEngineGaps','preservedCorporateMismatch','unresolvedResources','observedRowFieldTypes','forms'])assert.deepEqual(review[key],oldReview[key],key)
 assert.equal(review.resources.length,oldReview.resources.length)
 for(const resource of review.resources){
  const packet=assetMap.get(resource.url)
  if(packet){assert.equal(resource.sha256,packet.bodySHA256);assert.equal(resource.contentType,packet.contentType)}
  else assert.ok(oldReview.resources.some(r=>JSON.stringify(r)===JSON.stringify(resource)))
 }
})

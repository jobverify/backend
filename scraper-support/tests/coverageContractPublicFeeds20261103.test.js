import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const fixtures=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/coverage-contract-public-feeds-20261103.json.gz',import.meta.url)))).sources
const expected={epifi:0,sahajai:9,snyk:0,dialpad:0}
const catalog=getScraperCatalog()

for(const capture of fixtures){
 const provider=catalog.find(row=>row.source===capture.source)
 const pages=capture.pages||[capture.careers]
 const replay=async({page=value=>value,feed=value=>value,apiError}={})=>{
  const calls=[]
  const jobs=await createCatalogScraper(provider).run({
   fetchPage:async url=>{calls.push(url);const found=pages.find(value=>value.url===url);assert.ok(found,`Uncaptured public page: ${url}`)
    return page({status:found.status,url:found.finalUrl,html:found.html})},
   fetchJson:async url=>{calls.push(url);assert.equal(url,capture.feed.url)
    if(apiError)throw apiError
    return feed(JSON.parse(capture.feed.body))},
  })
  return{jobs,calls}
 }
 test(`${capture.source} registered source uses its current advertised public ATS`,()=>{
  assert.equal(provider.adapter,'publicAts')
  assert.equal(provider.bindingEvidence.verified,true)
  assert.equal(provider.runtimeInventoryVerification.boardUrl.includes(provider.boardToken),true)
  assert.equal(provider.zeroResultPolicy,'evidence-required')
 })
 test(`${capture.source} actual current public responses recover the registered source without marketing-copy predicates`,async()=>{
  assert.equal(createHash('sha256').update(capture.careers.html).digest('hex'),capture.careers.sha256)
  assert.equal(createHash('sha256').update(capture.feed.body).digest('hex'),capture.feed.sha256)
  const{jobs,calls}=await replay();assert.equal(jobs.length,expected[capture.source]);assert.equal(calls.length,pages.length+1)
  const evidence=readInventoryEvidence(jobs);assert.equal(evidence.firstParty,true);assert.equal(evidence.listingComplete,capture.source!=='dialpad')
  if(capture.source==='epifi'){assert.equal(evidence.status,'verified-empty');assert.equal(evidence.reportedTotal,0)}
  if(capture.source==='snyk'){assert.equal(evidence.reportedTotal,37);assert.equal(evidence.indiaFacetCount,0)}
  if(capture.source==='dialpad'){
   assert.equal(evidence.reportedTotal,12);assert.equal(evidence.indiaFacetCount,null)
   assert.equal(evidence.status,'discovery-only');assert.match(evidence.reason,/native-location-scope-unresolved/)
  }
  for(const job of jobs){assert.equal(job.source,capture.source);assert.ok(job.jobDescription?.length>150);assert.ok(job.sourceUrl.includes(provider.boardToken))}
 })
 test(`${capture.source} denied employer page cannot turn into an empty successful scrape`,async()=>{
  await assert.rejects(replay({page:value=>({...value,status:403})}),error=>error.failureKind==='source_identity_unverified')
 })
 test(`${capture.source} a foreign response URL cannot bind the company to a public feed`,async()=>{
  await assert.rejects(replay({page:value=>({...value,url:'https://unrelated.invalid/careers'})}),error=>error.failureKind==='source_identity_unverified')
 })
 test(`${capture.source} native access denials retain the original failure`,async()=>{
  const denial=Object.assign(Error('HTTP 403 from the current native API'),{status:403,abortRetries:true})
  await assert.rejects(replay({apiError:denial}),error=>error===denial)
 })
 if(capture.source!=='epifi')test(`${capture.source} a missing active employer handoff is rejected`,async()=>{
  await assert.rejects(replay({page:value=>({...value,html:value.html.replaceAll(provider.runtimeInventoryVerification.boardUrl,'https://unrelated.invalid/not-careers')})}),
   error=>error.failureKind==='source_identity_unverified')
 })
 if(capture.source==='dialpad'){
  test('Dialpad query identity alone cannot bind a feed without the matching native apply action',async()=>{
   await assert.rejects(replay({page:value=>({...value,html:value.html.replaceAll('/dialpad/jobs/8590367002','/dialpad/jobs/999999')})}),
    error=>error.failureKind==='source_identity_unverified')
  })
  test('Dialpad duplicate or foreign employer role query IDs cannot establish native binding',async()=>{
   for(const replacement of['?id=999&id=','?unrelated=']){
    await assert.rejects(replay({page:value=>({...value,html:value.html.replaceAll('/apply/?id=','/apply/'+replacement)})}),
     error=>error.failureKind==='source_identity_unverified')
   }
  })
  test('Dialpad a missing advertised role keeps the current inventory incomplete',async()=>{
   const{jobs}=await replay({page:value=>({...value,html:value.html.replaceAll('/apply/?id=8880622002','/apply/?unrelated=8880622002')})})
   assert.equal(readInventoryEvidence(jobs).listingComplete,false)
   assert.match(readInventoryEvidence(jobs).reason,/official-role-identities-not-reconciled/)
  })
  test('Dialpad a future native India posting remains selectable through the employer query identity contract',async()=>{
   const{jobs}=await replay({feed:payload=>{
    const record=payload.jobs[0]
    record.location={name:'Bengaluru, India'}
    record.offices=[{id:4017032002,name:'Bengaluru',location:'Bengaluru, Karnataka, India',child_ids:[],parent_id:null}]
    return payload
   }})
   assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India')
   assert.equal(String(jobs[0].jobId),'8880622002')
   assert.ok(jobs[0].jobDescription.length>150)
  })
 }
}

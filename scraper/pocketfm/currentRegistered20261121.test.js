import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-registered-20261121.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='pocketfm')
const expected=fixture.expectedJobs,victim=expected[0].jobId,sibling=expected[1].jobId
const sha=b=>createHash('sha256').update(b).digest('hex')
const needChange=(before,after)=>{assert.notEqual(after,before,'Mutation must change the complete current original');return after}
const changeSchema=(html,edit)=>needChange(html,html.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(_,open,body,close)=>{const schema=JSON.parse(body);edit(schema);return open+JSON.stringify(schema)+close}))
const replay=async(t,mutate=(_body)=>_body,options={})=>{
 const counts=new Map(),calls=[]
 const fetchImpl=async value=>{
  const url=String(value),index=counts.get(url)??0;counts.set(url,index+1);calls.push(url)
  const packet=fixture.packets.filter(row=>row.url===url)[index]
  assert.ok(packet,'Only bounded complete original public response sequence: '+url+' #'+index)
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(bytes.length,packet.bytes)
  assert.equal(sha(bytes),packet.sha256)
  assert.equal(packet.bodyOriginalUnmodified,true)
  assert.deepEqual(packet.bodyRedactions,[])
  const body=mutate(bytes.toString('utf8'),url,index+1)
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const jobs=await createCatalogScraper(provider).run({fetchImpl,...options})
 return{jobs,calls}
}
const assertHeld=(jobs,id=victim)=>{
 assert.equal(jobs.some(job=>job.jobId===id),false)
 assert.equal(jobs.some(job=>job.jobId===sibling),true,'Unrelated independently complete native role remains available')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readSourceObservationEvidence(jobs,'pocketfm').sourceScopeComplete,false)
}

test('Pocket FM actual registered current originals retain all native country, criteria and authored date models through closing',async t=>{
 const {jobs,calls}=await replay(t)
 assert.equal(calls.length,fixture.packets.length)
 assert.deepEqual(jobs.map(job=>job.jobId),expected.map(job=>job.jobId))
 const rows=JSON.parse(Buffer.from(fixture.packets.find(row=>row.url.startsWith('https://api.lever.co/')).bodyBase64,'base64'))
 for(const observed of expected){
  const job=jobs.find(row=>row.jobId===observed.jobId),native=rows.find(row=>row.id===observed.jobId)
  const original=fixture.packets.find(row=>row.url===job.sourceUrl)
  const schema=JSON.parse(Buffer.from(original.bodyBase64,'base64').toString('utf8').match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1])
  assert.deepEqual(job.sourceNativeRecord,native)
  assert.deepEqual(job.sourceNativeJobPosting,schema)
  assert.equal(job.postingDate,observed.postingDate)
  assert.equal(job.sourceNativeRecord.createdAt,observed.nativeCreatedAt)
  assert.equal(job.country,'India')
  assert.equal(job.sourceNativeRecord.country,'IN')
  assert.equal(sha(job.sourceDescription),observed.sourceDescriptionSHA256)
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceScopeComplete,false)
 }
 assert.equal(readSourceObservationEvidence(jobs,'pocketfm').observedRecordCount,fixture.observedNativeRows)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.deepEqual(jobs.nativeCollectionEvidence.failures,[])
})

test('Pocket FM current unknown assigned native country remains a held row without a country guess',async t=>{
 const {jobs}=await replay(t,(body,url)=>{
  if(!url.startsWith('https://api.lever.co/'))return body
  const rows=JSON.parse(body);rows.find(row=>row.id===victim).country='ZZ';return JSON.stringify(rows)
 })
 assertHeld(jobs)
 assert.equal(jobs.nativeCollectionEvidence.opening.find(row=>row.id===victim).country,'ZZ')
 assert.match(JSON.stringify(jobs.nativeCollectionEvidence.failures),/unknown native workplace country/)
})

for(const [name,edit] of [
 ['own employer',schema=>{schema.hiringOrganization.name='Other Employer'}],
 ['own assigned country',schema=>{schema.jobLocation.address.addressCountry='CA'}],
])test('Pocket FM current conflicting '+name+' schema holds only the affected role',async t=>{
 const {jobs}=await replay(t,(body,url)=>url.endsWith('/'+victim)?changeSchema(body,edit):body)
 assertHeld(jobs)
})

test('Pocket FM current unpaired original criterion remains in evidence and cannot qualify a complete role',async t=>{
 const {jobs}=await replay(t,(body,url)=>{
  if(!url.startsWith('https://api.lever.co/'))return body
  const rows=JSON.parse(body);rows.find(row=>row.id===victim).descriptionBody+='<p>Mandatory local security clearance.</p>';return JSON.stringify(rows)
 })
 assertHeld(jobs)
 assert.match(jobs.nativeCollectionEvidence.opening.find(row=>row.id===victim).descriptionBody,/Mandatory local security clearance/)
})

test('Pocket FM current closing publication date change cannot reuse the opening authored model',async t=>{
 const {jobs}=await replay(t,(body,url,visit)=>url.endsWith('/'+victim)&&visit===2?changeSchema(body,schema=>{schema.datePosted='2020-01-01'}):body)
 assertHeld(jobs)
 assert.match(JSON.stringify(jobs.nativeCollectionEvidence.failures),/closing original criteria\/application changed/)
})

test('Pocket FM current read-only required own application field holds its role',async t=>{
 const {jobs}=await replay(t,(body,url)=>url.endsWith('/'+victim+'/apply')?needChange(body,body.replace(/(<input\b[^>]*\bname="name")/,'$1 readonly')):body)
 assertHeld(jobs)
})

test('Pocket FM current caller abort preserves its reason before any public read',async t=>{
 const reason=Error('caller cancelled exact current registered acquisition'),controller=new AbortController();controller.abort(reason)
 const read=()=>assert.fail('A pre-aborted source cannot issue public reads')
 t.mock.method(globalThis,'fetch',read)
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:read,signal:controller.signal}),error=>error===reason)
})

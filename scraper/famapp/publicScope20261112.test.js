import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createFamAppScraper} from './script.js'
import {createFampayScraper} from '../fampay/script.js'
import {runCurrentFam} from './currentNative.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261112/public-contract-originals.json.gz',import.meta.url))))
const HOME='https://www.famapp.in/',CAREERS=HOME+'careers/',API='https://api.lever.co/v0/postings/fampay?mode=json',BOARD='https://jobs.lever.co/fampay'
const GENERAL=BOARD+'/e78e59db-fc28-4643-b389-03e75e19bf39'
const rows=JSON.parse(capture.responses.find(row=>row.requestedUrl===API).body)
const fixture=(change=(_url,body)=>body)=>{
 const seen=new Map(),requests=[]
 const get=url=>{const response=capture.responses.find(row=>row.requestedUrl===url);assert.ok(response,'Only actually retained public Fam contracts: '+url);return response}
 const altered=(url,body)=>{const count=(seen.get(url)??0)+1;seen.set(url,count);return change(url,body,count)}
 return {requests,now:'2026-11-12T16:30:00.000Z',fetchPage:async url=>{const row=get(url);return{status:row.status,url:row.finalUrl,html:change(url,row.body,0)}},fetchImpl:async url=>{
  requests.push(url);const row=get(url),response=new Response(altered(url,row.body),{status:row.status,headers:{'content-type':row.contentType}})
  Object.defineProperty(response,'url',{value:row.finalUrl});return response
 }}
}
const changeRows=update=>(url,body)=>url.startsWith(API)?JSON.stringify(JSON.parse(body).map(update)):body
const held=jobs=>{
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
}

test('genuine Fam public receipts have their original bytes and explicit sole-workplace native records',()=>{
 for(const response of capture.responses.filter(row=>row.body))assert.equal(createHash('sha256').update(response.body).digest('hex'),response.bodySha256)
 assert.equal(rows.length,18)
 assert.ok(rows.every(row=>row.country==='IN'&&row.categories.location==='Bengaluru'&&JSON.stringify(row.categories.allLocations)==='["Bengaluru"]'))
})
test('both aliases qualify only their reconciled current public Fam channel and preserve complete native criteria',async()=>{
 for(const[factory,source,company]of[[createFamAppScraper,'famapp','FamApp by Trio'],[createFampayScraper,'fampay','Fampay']]){
  const options=fixture(),jobs=await factory().run(options)
  assert.equal(jobs.length,18)
  assert.ok(jobs.every(job=>job.source===source&&job.company===company&&job.legalEmployer===null&&job.officialBrandName==='FamApp by Trio'))
  assert.ok(jobs.every(job=>job.sourceDetailComplete&&job.sourceScopeComplete===true&&job.lifecycleCleanupAllowed===true),JSON.stringify(jobs.nativeCollectionEvidence.publicScopeFailures))
  assert.equal(sourceLifecycleCleanupForbidden(jobs),false)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,true)
  assert.ok(options.requests.includes(BOARD),'The independently published native root must be read')
  assert.ok(options.requests.some(url=>url.includes('skip=18&limit=100')),'The actual terminal native page must be read')
  for(const job of jobs){
   const original=rows.find(row=>row.id===job.jobId)
   assert.deepEqual(job.sourceNativeJobRecord,original)
   assert.ok(job.jobDescription.includes(original.description.trim()))
   for(const section of original.lists)assert.ok(job.jobDescription.includes(section.content.trim()))
   assert.deepEqual(job.nativeCollectionEvidence.publicScope.excludedScope,['unadvertised-private-or-internal-postings','legal-employer-and-related-entity-recruitment'])
  }
 }
})
test('native Lever creation time is retained separately from unknown publication time',async()=>{
 const jobs=await createFamAppScraper().run(fixture())
 for(const job of jobs){assert.equal(job.postingDate,null);assert.equal(job.nativeCreatedAt,new Date(job.sourceNativeJobRecord.createdAt).toISOString());assert.equal(job.sourcePublicationDate,null)}
})
test('Fam preserves actual native HTML criteria omitted by the redundant plain variants',async()=>{
 const jobs=await createFamAppScraper().run(fixture())
 for(const id of['01750a61-a53b-433f-8d8c-bfb5a18417f8','213870db-ddfd-4519-9a57-54691d89cca5']){
  const original=rows.find(row=>row.id===id),job=jobs.find(row=>row.jobId===id)
  assert.ok(job,'Original complete native criteria must remain recoverable: '+id)
  assert.ok(job.jobDescription.includes(original.description.trim()),'Exact full native HTML must be retained')
  assert.deepEqual(job.sourceNativeJobRecord,original)
 }
 assert.ok(jobs.find(row=>row.jobId==='01750a61-a53b-433f-8d8c-bfb5a18417f8').jobDescription.includes('OLake'))
})
for(const[description,locations]of[
 ['absent',undefined],['null',null],['empty',[]],['missing primary',['Mumbai, India']],['unknown secondary',['Bengaluru','Singapore']],['blank secondary',['Bengaluru','']],['contradictory secondary',['Bengaluru','New York, United States']],['wrong type',['Bengaluru',{}]],
])test('Fam retains a scope hold for '+description+' complete worksite country evidence',async()=>{
 const jobs=await createFamAppScraper().run(fixture(changeRows((row,index)=>index?row:{...row,categories:{...row.categories,allLocations:locations}})))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null);held(jobs)
})
test('a native primary country cannot contradict its own explicitly foreign location',async()=>{
 const jobs=await createFamAppScraper().run(fixture(changeRows((row,index)=>index?row:{...row,categories:{...row.categories,location:'Toronto, Canada',allLocations:['Toronto, Canada']}})))
 held(jobs);assert.equal(jobs.length,17);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
for(const[url,markup]of[
 [HOME,'<a href="https://new-channel.example/">Opportunities</a>'],[CAREERS,'<a href="https://new-channel.example/">A different door</a>'],
 [HOME,'<script type="module">import "https://new-channel.example/widget.js"</script>'],[CAREERS,'<script>window.extraRecruiter="https://new-channel.example/"</script>'],
 [HOME,'<iframe></iframe>'],[CAREERS,'<iframe srcdoc="new public roles"></iframe>'],[CAREERS,'<iframe src="https://new-channel.example/"></iframe>'],
])test('unreviewed active Fam navigation or programmes retain source scope: '+url+' '+markup.slice(0,30),async()=>{
 const jobs=await createFamAppScraper().run(fixture((target,body)=>target===url?body.replace('</body>',markup+'</body>'):body))
 held(jobs);assert.equal(jobs.length,18)
})
test('a new native board continuation cannot silently certify an incomplete API subset',async()=>{
 const jobs=await createFamAppScraper().run(fixture((url,body)=>url===BOARD?body.replace('</body>','<a href="?skip=18">More positions</a></body>'):body))
 held(jobs)
})
test('an omitted native board role keeps cleanup held even when both JSON reads are stable',async()=>{
 const jobs=await createFamAppScraper().run(fixture((url,body)=>url===BOARD?body.replace('data-qa-posting-id="'+rows[0].id+'"','data-qa-posting-id="00000000-0000-0000-0000-000000000000"'):body))
 held(jobs)
})
test('an independent native pagination mismatch keeps cleanup held',async()=>{
 const jobs=await createFamAppScraper().run(fixture((url,body)=>url.includes('skip=0&limit=100')?JSON.stringify(JSON.parse(body).slice(1)):body))
 held(jobs)
})
for(const url of[BOARD,GENERAL])test('new native public executable declarations keep scope held: '+url,async()=>{
 const jobs=await createFamAppScraper().run(fixture((target,body)=>target===url?body.replace('</body>','<script type="module">import "https://new-channel.example/widget.js"</script></body>'):body))
 held(jobs)
})
test('a hidden native executable remains a programme declaration',async()=>{
 const jobs=await createFamAppScraper().run(fixture((url,body)=>url===GENERAL?body.replace('</body>','<div hidden><script>window.extraRecruiter="https://new-channel.example/"</script></div></body>'):body))
 held(jobs)
})
test('a hidden native frame remains an unreviewed public channel',async()=>{
 const jobs=await createFamAppScraper().run(fixture((url,body)=>url===BOARD?body.replace('</body>','<iframe hidden src="https://new-channel.example/"></iframe></body>'):body))
 held(jobs)
})
test('the advertised general-application pool requires its complete current native criteria',async()=>{
 const jobs=await createFamAppScraper().run(fixture((url,body)=>url===GENERAL?body.replaceAll('nothing on this page fits','a new dedicated job fits'):body))
 held(jobs)
})
test('a changed lazy careers programme cannot silently add a public channel',async()=>{
 const jobs=await createFamAppScraper().run(fixture((url,body)=>url.endsWith('36yj1rvs72o23.js')?body+';window.extraRecruiter="https://new-channel.example/";':body))
 held(jobs)
})
test('foreign native rows also require complete criteria before public inventory cleanup',async()=>{
 const jobs=await createFamAppScraper().run(fixture(changeRows((row,index)=>index?row:{...row,country:'US',categories:{...row.categories,location:'New York, United States',allLocations:['New York, United States']},
  description:'',descriptionPlain:'',opening:'',openingPlain:'',descriptionBody:'',descriptionBodyPlain:'',lists:[],additional:'',additionalPlain:''})))
 held(jobs);assert.ok(jobs.nativeCollectionEvidence.missingFullCriteriaIds.includes(rows[0].id))
})
test('caller zero cap retains an explicit array-level cleanup hold',async()=>{
 const jobs=await createFamAppScraper().run({...fixture(),maxJobs:0})
 assert.equal(jobs.length,0);held(jobs);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('a native empty JSON response does not override a populated public board',async()=>{
 const jobs=await createFampayScraper().run(fixture((url,body)=>url.startsWith(API)?'[]':body))
 assert.equal(jobs.length,0);held(jobs);assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})
test('source aliases reject a company label from the other alias',async()=>{
 await assert.rejects(runCurrentFam({...fixture(),source:'famapp',company:'Fampay'}),/identity|alias|company/i)
 await assert.rejects(runCurrentFam({...fixture(),source:'fampay',company:'FamApp by Trio'}),/identity|alias|company/i)
})

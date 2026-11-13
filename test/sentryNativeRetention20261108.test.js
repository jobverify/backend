import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'

// Saved responses are an offline regression fixture, not a current publisher inventory.
const R=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const SOURCE_FILE=path.join(R,'scraper/sentry/script.js')
assert.notEqual(path.resolve(process.argv[1]),path.resolve(SOURCE_FILE),'source CLI guard must be false before import')
let defaultFetchCalls=0
globalThis.fetch=async()=>{defaultFetchCalls++;throw Error('retention regression forbids default/public fetch')}
const {getScraperCatalog,createCatalogScraper}=await import(pathToFileURL(path.join(R,'scraper-support/providers/index.js')).href)
const registered=getScraperCatalog().find(provider=>provider.source==='sentry')
assert.equal(registered.adapter,'script')
assert.equal(path.resolve(registered.modulePath),path.resolve(R,'scraper/sentry/script.js'))
const source=await import(pathToFileURL(SOURCE_FILE).href)
const fixtureFile=path.join(R,'scraper/sentry/test-data/native-current-20261102.json.gz')
const packed=fs.readFileSync(fixtureFile),inflated=gunzipSync(packed,{maxOutputLength:16*1024*1024})
const fixture=JSON.parse(inflated),expectedPayload=fixture.responses.inventory
const trace=JSON.parse(fs.readFileSync(new URL('./test-data/sentryNativeRetention20261108.manifest.json',import.meta.url),'utf8'))
const expectedProps={propsSHA256:trace.corporatePropsSHA256}
const expectedCorporateRoles=new Map(trace.corporateRoles.map(row=>[row.id,row]))
const CAREERS='https://sentry.io/careers/',API='https://api.ashbyhq.com/posting-api/job-board/sentry',UNKNOWN='960b966a-849f-421f-8c75-72924f28293e'
const sha=value=>createHash('sha256').update(value).digest('hex')
assert.equal(expectedPayload.jobs.length,40)
assert.equal(expectedPayload.jobs.find(row=>row.id===UNKNOWN).address,null)
assert.equal(sha(packed),'65e4b95ac65f358444fd0ef164f6f10ed1b38e7d0cab044bd3dd9b23f9ba69b8')

assert.equal(sha(packed),trace.fixtureSHA256)
for(const [body,expected] of [[fixture.responses.corporate,trace.corporateResponse],[JSON.stringify(expectedPayload),trace.nativeResponse]]){
 assert.equal(Buffer.byteLength(body),expected.bytes)
 assert.equal(sha(body),expected.sha256,'saved original body must match its independent receipt')
}

async function collect(route,{changeClosing=false,maxJobs=null}={}){
 const opening=structuredClone(expectedPayload),closing=structuredClone(expectedPayload),calls=[]
 if(changeClosing)closing.jobs[0].futureNativeCriterion={required:true}
 const fetchImpl=async(url,init={})=>{
  assert.equal(url,[CAREERS,API,API,CAREERS][calls.length%4],'only complete four-request cohorts are admitted')
  assert.ok(init.signal instanceof AbortSignal)
  calls.push(url)
  const payload=calls.length%4===2?opening:closing
  return{ok:true,status:200,url,headers:new Headers({'content-type':url===API?'application/json':'text/html; charset=utf-8'}),text:async()=>fixture.responses.corporate,json:async()=>payload}
 }
 const options={fetchImpl,signal:new AbortController().signal,maxJobs,totalBudgetMs:20000,requestTimeoutMs:3000}
 const jobs=route==='exported'?await source.run(options):await createCatalogScraper(registered).run(options)
 assert.equal(calls.length,4)
 assert.equal(defaultFetchCalls,0)
 return{jobs,opening,closing,calls}
}

function completeAudit(jobs){
 assert.equal(jobs.length,0,'the retained original fixture has no qualifying India selection')
 const audit=Object.getOwnPropertyDescriptor(jobs,'nativeCollectionEvidence')?.value
 assert.ok(Array.isArray(audit?.nativeRecords),'complete native records must survive an empty India selection')
 assert.equal(audit.nativeRecords.length,40)
 assert.deepEqual(audit.nativeRecords,expectedPayload.jobs,'all raw native fields and complete criteria must survive')
 assert.deepEqual(audit.opening.payload,expectedPayload)
 assert.deepEqual(audit.closing.payload,expectedPayload)
 for(const phase of [audit.opening,audit.closing]){
  assert.ok(phase.corporate.rows instanceof Map)
  assert.equal(phase.corporate.rows.size,40)
  assert.equal(phase.corporate.props.jobs.length,40)
  assert.equal(phase.corporate.props.currentUrl,CAREERS)
  assert.equal(sha(phase.corporate.nativePropsRaw),expectedProps.propsSHA256,'complete raw corporate hydration must survive')
  for(const native of expectedPayload.jobs){
   const row=phase.corporate.rows.get(native.id)
   assert.equal(sha(row.info.descriptionHtml),expectedCorporateRoles.get(native.id).descriptionHTMLSHA256,'full corporate description must remain byte-exact to its own original')
   assert.equal(row.info.applyLink,native.jobUrl)
  }
 }
 assert.deepEqual(audit.unresolvedCountryRoleIds,[UNKNOWN])
 assert.equal(audit.nativeRecords.find(row=>row.id===UNKNOWN).address,null,'missing native country is retained without city inference')
 assert.equal(audit.source,'sentry')
 assert.equal(audit.observedRecordCount,40)
 assert.equal(audit.observedVacancyCount,40)
 assert.equal(audit.closingInventoryAndCriteriaMatch,true)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.receipts.length,4)
 assert.equal(Object.getOwnPropertyDescriptor(jobs,'nativeCollectionEvidence').enumerable,false)
 assert.equal(JSON.stringify(jobs),'[]','audit metadata must not be emitted as job rows')
 const inventory=jobs[Symbol.for('jobverify.inventory-evidence')]
 assert.equal(inventory.listingComplete,false)
 assert.equal(inventory.indiaFacetCount,null)
 assert.equal(inventory.reportedTotal,40)
 const observations=jobs[Symbol.for('jobverify.source-observation-evidence')]
 assert.equal(observations.observedRecordCount,40)
 assert.equal(observations.sourceScopeComplete,false)
 assert.equal(observations.companyIndiaTotal,null)
 return audit
}

test('exported run retains every original native and corporate model after an empty India selection',async()=>{
 const {jobs}=await collect('exported')
 completeAudit(jobs)
})

test('registered script route preserves the full nonenumerable audit and existing coverage holds',async()=>{
 const {jobs}=await collect('registered')
 completeAudit(jobs)
})

test('retained opening and closing models are detached from caller-owned parsed responses',async()=>{
 const {jobs,opening,closing}=await collect('exported'),audit=completeAudit(jobs)
 assert.notEqual(audit.opening.payload,opening)
 assert.notEqual(audit.closing.payload,closing)
 opening.jobs[0].descriptionHtml='caller changed opening criteria'
 closing.jobs.find(row=>row.id===UNKNOWN).address={postalAddress:{addressCountry:'India'}}
 assert.deepEqual(audit.nativeRecords,expectedPayload.jobs)
 assert.deepEqual(audit.opening.payload,expectedPayload)
 assert.deepEqual(audit.closing.payload,expectedPayload)
})

test('synthetic closing native criteria change still rejects before publishing a reconciled audit',async()=>{
 await assert.rejects(collect('registered',{changeClosing:true}),/closing corporate\/native full inventory, criteria, geography or publication changed/)
})

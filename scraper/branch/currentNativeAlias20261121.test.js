import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {API_URL,BOARD_URL,CAREERS_URL,LEGAL_URL} from '../branchmetrics/native.js'

const packets=JSON.parse(gunzipSync(readFileSync(new URL('../branchmetrics/test-data/current-partial-20261121.json.gz',import.meta.url))))
const bodies=new Map(packets.map(packet=>[packet.requestedUrl,packet.body]))
const advertisedNativeRoleURLs=new Set(JSON.parse(bodies.get(API_URL)).items.map(row=>row.url))
const indiaId='454f3d28-ca85-4640-9cfe-c48f1931cfdc'
const indiaURL=BOARD_URL+'/'+indiaId
const provider=()=>getScraperCatalog().find(row=>row.source==='branch')
const run=options=>createCatalogScraper(provider()).run(options)
function replay(t,change=(_url,body)=>body){
 const calls=[];let lists=0
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  calls.push(String(url))
  if(String(url)===API_URL&&++lists===2)throw Error('controlled closing transport503')
  const body=bodies.get(String(url))
  if(body===undefined)throw Error('Uncaptured original response '+url)
  const response=new Response(change(String(url),body),{status:200,headers:{'content-type':String(url).includes('/api/')?'application/json':'text/html'}})
  Object.defineProperty(response,'url',{value:String(url)})
  assert.equal(init.credentials,'omit')
  assert.equal(init.redirect,'manual')
  return response
 })
 return calls
}

test('Branch and Branch Metrics registrations bind the same original corporate employer surface',()=>{
 const other=getScraperCatalog().find(row=>row.source==='branchmetrics')
 assert.equal(provider().companyCareerPage,'https://www.branch.io/careers/')
 assert.equal(other.companyCareerPage,provider().companyCareerPage)
 assert.equal(provider().companyDomain,'branch.io')
 assert.equal(other.companyDomain,'branch.io')
})

test('registered Branch uses full current native employer and role proof while retaining the Branch source identity',async t=>{
 const calls=replay(t),jobs=await run()
 assert.equal(jobs.length,1)
 const job=jobs[0]
 assert.equal(job.source,'branch')
 assert.equal(job.jobId,indiaId)
 assert.equal(job.country,'India')
 assert.equal(job.company,'Branch Metrics')
 assert.equal(job.postingDate,'2026-10-12T23:58:53.547000-07:00')
 assert.equal(job.sourceDetailComplete,true)
 assert.deepEqual(job.sourceNativeWorkLocations,['Bengaluru, India','London, United Kingdom'])
 assert.ok(job.jobDescription.includes('mobile marketing measurement and deep linking solutions'))
 assert.ok(calls.includes(LEGAL_URL))
 assert.equal(calls.find(url=>url.startsWith(BOARD_URL+'/')),indiaURL)
 assert.equal(jobs.nativeCollectionEvidence.source,'branch')
 assert.equal(jobs.nativeCollectionEvidence.nativeReaderSource,'branchmetrics')
 assert.equal(jobs.nativeCollectionEvidence.closingComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('registered Branch rejects a conflicting original legal publisher without generic alternate requests',async t=>{
 const calls=replay(t,(url,body)=>{
  if(url!==LEGAL_URL)return body
  const changed=body.replaceAll('Branch Metrics','Another Employer')
  assert.notEqual(changed,body,'The legal publisher control must change actual original bytes')
  return changed
 })
 await assert.rejects(run(),/legal employer missing/)
 assert.equal(calls.filter(url=>url===LEGAL_URL).length,1)
 assert.ok(calls.every(url=>bodies.has(url)))
})

test('registered Branch holds a native country conflict before any India detail can qualify',async t=>{
 replay(t,(url,body)=>{
  if(url!==API_URL)return body
  const value=JSON.parse(body)
  assert.notEqual(value.items[0].locations[0].countryCode,'IN')
  value.items[0].locations[0].countryCode='IN'
  return JSON.stringify(value)
 })
 await assert.rejects(run(),/country|board and public API/)
})

test('registered Branch cannot retain an India role whose own full criteria conflict with its listing',async t=>{
 const calls=replay(t,(url,body)=>url!==indiaURL?body:body.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/i,(_match,start,raw,end)=>{
  const value=JSON.parse(raw)
  value.props.pageProps.apiData.jobPost.companyName='Another Employer, Inc.'
  return start+JSON.stringify(value).replaceAll('<','\\u003c')+end
 }))
 const jobs=await run()
 assert.equal(jobs.length,0)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const alternate=calls.filter(url=>!bodies.has(url)&&!advertisedNativeRoleURLs.has(url))
 assert.deepEqual(alternate,[],'Advertised native details missing from this partial fixture stay distinct from generic alternate acquisition')
 assert.equal(calls.filter(url=>url===CAREERS_URL).length,1,'An authoritative role hold must not restart corporate discovery')
})

for(const reason of [null,Object.freeze({cancelledByCaller:true})])test('registered Branch preserves an exact already-aborted caller reason '+String(reason),async t=>{
 let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('No reads after caller abort')})
 const controller=new AbortController();controller.abort(reason)
 await assert.rejects(run({signal:controller.signal}),error=>error===reason)
 assert.equal(calls,0)
})

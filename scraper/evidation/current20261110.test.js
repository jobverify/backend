import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const load=file=>JSON.parse(gunzipSync(readFileSync(new URL(file,import.meta.url))))
const captured=load('./fixtures/current-deployment-20261110.json.gz'),programs=load('./fixtures/current-client-20261110.json.gz').programs
const CLIENT='https://ats.us1.rippling.com/_next/static/chunks/387-80356090a770fa21.js'
const FRAME='https://ats.rippling.com/embed/evidation/jobs?s=https%3A%2F%2Fevidation.com%2Fopen-positions'
const nativePages=[...captured.responses,...programs.map(row=>({...row,headers:{'content-type':row.contentType}}))]
const nextReason=Object.freeze({controlledNativeBoundary:'pagination not acquired'})
function replay(t,mutate=value=>value){
 const calls=[]
 t.mock.method(globalThis,'fetch',async url=>{
  calls.push(url);const row=nativePages.find(row=>row.url===url)
  if(!row){assert.equal(url,FRAME+'&page=1');throw nextReason}
  const value=mutate({...row},url)
  const response=new Response(value.body,{status:value.status,headers:value.headers})
  Object.defineProperty(response,'url',{value:value.finalUrl});return response
 })
 return calls
}
const run=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='evidation')).run()

// Retaining only the old chunk URL rejects current genuine board pagination
// before the source can apply its unchanged terminal/full-role guards.
test('Evidation admits the currently declared exact pagination client before its native terminal read',async t=>{
 for(const row of nativePages){assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)}
 const calls=replay(t)
 await assert.rejects(run(),error=>error===nextReason)
 assert.deepEqual(calls,[captured.responses[0].url,captured.responses[1].url,FRAME,CLIENT,FRAME+'&page=1'])
})
test('Evidation rejects changed bytes at the reviewed current pagination URL',async t=>{
 const calls=replay(t,(row,url)=>url===CLIENT?{...row,body:row.body+'\n;'}:row)
 await assert.rejects(run(),/pagination client contract changed/);assert.equal(calls.length,4)
})
test('Evidation rejects a foreign final pagination program URL',async t=>{
 const calls=replay(t,(row,url)=>url===CLIENT?{...row,finalUrl:'https://foreign.invalid/client.js'}:row)
 await assert.rejects(run(),/redirect identity changed/);assert.equal(calls.length,4)
})
for(const[name,mutate]of[
 ['an unreviewed pagination declaration',html=>html.replaceAll(CLIENT,CLIENT.replace('80356090','00000000'))],
 ['a duplicate pagination declaration',html=>html+'<script src="'+CLIENT+'"></script>'],
 ['ambiguous reviewed deployments',html=>html+'<script src="https://ats.us1.rippling.com/_next/static/chunks/7387-5690a0f62ce3232b.js"></script>'],
])test('Evidation refuses '+name,async t=>{
 const calls=replay(t,(row,url)=>url===FRAME?{...row,body:mutate(row.body)}:row)
 await assert.rejects(run(),/advertised pagination client missing/);assert.equal(calls.length,3)
})
test('Evidation still rejects contradictory native country fields before loading its current client',async t=>{
 const calls=replay(t,(row,url)=>url===FRAME?{...row,body:row.body.replace('"countryCode":"US"','"countryCode":"IN"')}:row)
 await assert.rejects(run(),/country\/geography missing or contradictory/);assert.equal(calls.length,3)
})

const full=load('./fixtures/current-full-run-20261110.json.gz')
function fullReplay(t,mutate=value=>value){
 const calls=[]
 t.mock.method(globalThis,'fetch',async url=>{
  calls.push(url);const n=calls.filter(value=>value===url).length
  const row=full.responses.filter(row=>row.url===url)[n-1];assert.ok(row,'Unexpected full native request: '+url)
  const value=mutate({...row},url,n),response=new Response(value.body,{status:value.status,headers:value.headers})
  Object.defineProperty(response,'url',{value:value.finalUrl});return response
 })
 return calls
}
test('Evidation current full native run reconciles three US roles without certifying India emptiness',async t=>{
 for(const row of full.responses)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
 const calls=fullReplay(t),jobs=await run()
 assert.equal(jobs.length,0);assert.equal(calls.length,16)
 assert.equal(calls.filter(url=>url.startsWith('https://ats.rippling.com/en-US/evidation/jobs/')).length,6)
 assert.deepEqual(jobs[Symbol.for('jobverify.official-ats-discovery')].nativeInventory,{observedNativeRows:3,observedUniqueRoles:3,observedIndiaRoles:0,snapshots:2,pagesPerSnapshot:2,allDetailsValidated:true})
 const inventory=readInventoryEvidence(jobs)
 assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false)
 assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
})
test('Evidation current full run rejects changed closing client bytes before trusting opening roles',async t=>{
 fullReplay(t,(row,url,n)=>url===CLIENT&&n===2?{...row,body:row.body+'\n;'}:row)
 await assert.rejects(run(),/pagination client contract changed/)
})
test('Evidation current full run still requires the native full role criteria',async t=>{
 fullReplay(t,(row,url)=>{
  if(!url.startsWith('https://ats.rippling.com/en-US/evidation/jobs/'))return row
  return{...row,body:row.body.replace(/(<script\b[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,before,raw,after)=>{
   const value=JSON.parse(raw);value.props.pageProps.apiData.jobPost.description.role=''
   return before+JSON.stringify(value).replaceAll('<','\\u003c')+after
  })}
 })
 await assert.rejects(run(),/full employer description\/content missing/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,extractIndiaJobsFromCards,extractJobCardsFromSearchPage} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-held-20261117.json.gz',import.meta.url))))
function replay(edit=(p,s)=>s,original=fixture){const reads=[],counts=new Map(),responses=original.responses??original.requests;return {reads,options:{requestIntervalMs:0,fetchText:async()=>Buffer.from(responses[0].bodyBase64,'base64').toString(),fetchImpl:async(url,init)=>{
 reads.push(String(url));const count=counts.get(String(url))??0;counts.set(String(url),count+1)
 const packets=responses.filter(p=>p.requestedURL===String(url)),p=packets[count]??packets.at(-1);assert.ok(p,'Only current first-party declared URLs '+url)
 assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.sha256)
 assert.equal(init.redirect,'manual');const text=edit(p,Buffer.from(p.bodyBase64,'base64').toString())
 return Object.defineProperty(new Response(p.status===202?null:text,{status:p.status,headers:p.headers}),'url',{value:p.url})
}}}}
test('Rapid7 current native metadata cannot become eligible when criteria/application and closing remain held',async()=>{
 const first=Buffer.from(fixture.responses[0].bodyBase64,'base64').toString()
 const legacy=extractIndiaJobsFromCards(extractJobCardsFromSearchPage(first),fixture.observedAt)
 assert.equal(legacy.length,2);assert.ok(legacy.every(row=>row.jobDescription===null),'Current original produced two legacy metadata-only India candidates')
 const {options,reads}=replay(),jobs=await run(options)
 assert.equal(jobs.length,0,'No metadata-only eligible jobs')
 assert.equal(readSourceObservationEvidence(jobs,'rapid7india').observedRecordCount,45)
 assert.equal(jobs.nativeCollectionEvidence.candidateDetails,5);assert.equal(jobs.nativeCollectionEvidence.failures.length,5)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningDetails.length,4)
 assert.equal(jobs.nativeCollectionEvidence.failures.at(-1).httpStatus,202)
 assert.equal(jobs.nativeCollectionEvidence.closingInventoryMatches,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(reads.at(-1),'https://careers.rapid7.com/jobs/staff-ai-engineer-lead-pune-india')
 assert.equal(reads.length,7,'Challenge stops further reads and closing attempts')
})
test('Rapid7 held native criteria audit preserves authored word boundaries',async()=>{
 const {options}=replay((p,s)=>p.requestedURL.includes('/jobs/principal-ai-engineer')?s.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(_all,open,body,close)=>{
  const schema=JSON.parse(body);schema.description=schema.description.replace('Rapid7','Rapid 7');return open+JSON.stringify(schema)+close
 }):s)
 await assert.rejects(run(options),/criteria/i)
})
test('Rapid7 rejects changed current row authority and preserves exact caller abort',async()=>{
 const {options}=replay((p,s)=>p.requestedURL.endsWith('/jobs/search')?s.replaceAll('https://careers.rapid7.com/jobs/principal-ai-engineer','https://unrelated.invalid/jobs/principal-ai-engineer'):s)
 await assert.rejects(run(options),/native|identity|current|row/i)
 const c=new AbortController();c.abort(null);let count=0
 await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{count++}}),e=>e===null);assert.equal(count,0)
})
test('Rapid7 actual eight original reads retain all45 observations/five own JDs when closing search is AWS202',async()=>{
 const original=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-closing-held-20261117.json.gz',import.meta.url))))
 const {reads,options}=replay(undefined,original),jobs=await run(options)
 assert.equal(reads.length,8);assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'rapid7india').observedRecordCount,45)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningDetails.length,5)
 assert.equal(jobs.nativeCollectionEvidence.failures.length,6)
 assert.deepEqual(jobs.nativeCollectionEvidence.failures.at(-1),{stage:'closing-inventory',reason:'native-http-access-denied',httpStatus:202})
 assert.equal(jobs.nativeCollectionEvidence.closingInventoryMatches,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

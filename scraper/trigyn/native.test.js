import assert from 'node:assert/strict'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {createCapturedFetch as playback,readCapture} from './capturedPlayback.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parsePage} from './native.js'

test('Trigyn retained HTTP captures match file and exact response-body SHA256 hashes',()=>{
  const manifest=readCapture('capture-manifest'),hash=value=>createHash('sha256').update(value).digest('hex')
  for(const entry of manifest.files){
    const bytes=readFileSync(new URL(`./fixtures/${entry.file}`,import.meta.url))
    assert.equal(hash(bytes),entry.sha256)
    const raw=entry.file.endsWith('.gz')?gunzipSync(bytes):bytes
    assert.equal(hash(raw),entry.uncompressedSha256)
    const data=JSON.parse(raw),responses=(Array.isArray(data)?data:[data]).filter(r=>r?.url&&typeof r.body==='string')
    assert.equal(responses.length,entry.responses.length)
    responses.forEach((row,index)=>{assert.equal(hash(row.body),entry.responses[index].bodySha256);assert.equal(row.url,entry.responses[index].url);assert.equal(row.capturedAt,entry.responses[index].capturedAt)})
  }
})

test('Trigyn module import performs no network or persistence action',async()=>{
  const original=globalThis.fetch
  globalThis.fetch=()=>{throw Error('network during import')}
  try{await import(new URL('./script.js?verify-import-safety',import.meta.url))}finally{globalThis.fetch=original}
})

test('Trigyn replays all six official region inventories and the independent India facet', async () => {
  const jobs = await run({fetch:playback(),now:()=> '2026-10-23T05:00:00.000Z'})
  assert.equal(jobs.length,227)
  assert.equal(new Set(jobs.map(job=>job.jobId)).size,227)
  assert.equal(jobs.filter(job=>job.country==='India').length,40)
  assert.equal(jobs.filter(job=>job.sourceDetailComplete).length,227)
  assert.ok(jobs.every(job=>job.postingDate===null))
  assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length,40)
  const first=jobs.find(job=>job.jobId==='14654')
  assert.equal(first.title,'Fresher')
  assert.equal(first.requisitionId,'G1026-0016')
  assert.equal(first.company,'Trigyn')
  assert.equal(first.source,'trigyn')
  assert.equal(first.location,'Gurugram, India')
  assert.match(first.jobDescription,/PowerApps, Power Automate/)
  assert.equal(first.postingDate,null)
  assert.equal(first.sourceDetailComplete,true)
  assert.equal(jobs.find(job=>job.country==='Remote (Asia)').country,'Remote (Asia)')
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,'complete-inventory')
  assert.equal(evidence.reportedTotal,227)
  assert.equal(evidence.indiaFacetCount,40)
  assert.equal(evidence.listingComplete,true)
  assert.equal(evidence.verifiedAt,'2026-10-23T05:00:00.000Z')
})

test('Trigyn rejects truncated regional pages despite a successful HTTP status',async()=>{
  const fetch=playback(row=>{
    if(row.requestBody){const body=JSON.parse(row.body);if(body.jobs?.length===20){body.jobs.pop();row.body=JSON.stringify(body)}}
    return row
  })
  await assert.rejects(run({fetch}),/page|count|range|inventory/i)
})

test('Trigyn rejects aliases outside the official job route',async()=>{
  const fetch=playback(row=>{
    if(row.requestBody){const body=JSON.parse(row.body);if(body.jobs?.length){body.jobs[0].alias='https://example.com/job/other';row.body=JSON.stringify(body)}}
    return row
  })
  await assert.rejects(run({fetch}),/identity|alias|route/i)
})

test('Trigyn retains a failed native detail as nullable partial content',async()=>{
  const jobs=await run({fetch:playback(row=>row.url.endsWith('/job/fresher')?{...row,status:503}:row)})
  const first=jobs.find(job=>job.jobId==='14654')
  assert.equal(jobs.length,227)
  assert.equal(first.jobDescription,null)
  assert.equal(first.sourceDetailComplete,false)
  assert.equal(first.sourceListingComplete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('Trigyn rejects unknown native scope fields and contradictory location countries',async()=>{
  for(const change of [row=>({...row,SecondaryCountry:'India'}),row=>({...row,location:'Toronto, Canada'})]) {
    await assert.rejects(run({fetch:playback(row=>{
      if(row.requestBody){const body=JSON.parse(row.body);if(body.jobs?.length){body.jobs[0]=change(body.jobs[0]);row.body=JSON.stringify(body)}}return row
    })}),/scope|geograph|country|location|schema/i)
  }
})

test('Trigyn rejects foreign state codes and complete country names outside the current native country facets',async()=>{
  for(const location of ['Bengaluru, CA','Bengaluru, NY','Bengaluru, Poland','Bengaluru, Japan','Japan / Bengaluru']) {
    await assert.rejects(run({fetch:playback(row=>{
      if(row.requestBody){const body=JSON.parse(row.body);const job=body.jobs?.find(j=>j.country_name==='India');if(job){job.location=location;row.body=JSON.stringify(body)}}return row
    })}),/native location\/country geography contradiction/i)
  }
})

test('Trigyn preserves multiple India city labels and ambiguous India state abbreviations',()=>{
  const captured=readCapture('native-responses').find(row=>row.requestBody==='param=%7B%22region%22%3A%2254%22%2C%22current_page%22%3A%220%22%7D')
  for(const location of ['Bengaluru, Hyderabad','Bengaluru / Mumbai','Chennai, TN','Panaji, GA']){
    const payload=JSON.parse(captured.body),raw=payload.jobs.find(job=>job.country_name==='India');raw.location=location
    const parsed=parsePage(payload,{regions:payload.dropdown.region,page:0})
    assert.equal(parsed.jobs.find(job=>job.jobId===raw.nid).nativeLocation,location)
    assert.equal(parsed.jobs.find(job=>job.jobId===raw.nid).country,'India')
  }
})

test('Trigyn retains heading-only, strong-only and inert descriptions as partial null content',async()=>{
  for(const replacement of ['<strong>Job Description:</strong><h2>Responsibilities</h2>','<strong>Responsibilities</strong>','<div style="content-visibility:hidden">Build PowerApps applications</div>']) {
    const jobs=await run({fetch:playback(row=>{
      if(row.url.endsWith('/job/fresher')){
        const d=document(row.body),nodes=d.nodes(n=>n.tag==='div'&&d.hasClass(n,'column-content'))
        for(const n of nodes.reverse())row.body=row.body.slice(0,n.openEnd)+replacement+row.body.slice(n.closeStart)
      }return row
    })})
    const first=jobs.find(job=>job.jobId==='14654')
    assert.equal(first.jobDescription,null)
    assert.equal(first.sourceDetailComplete,false)
    assert.equal(jobs.length,227)
  }
})

test('Trigyn rejects known detail location and identity contradictions',async()=>{
  for(const replace of [body=>body.replace('Gurugram</span>','Toronto, Canada</span>'),body=>body.replace('data-history-node-id="14654"','data-history-node-id="99999"')]) {
    await assert.rejects(run({fetch:playback(row=>row.url.endsWith('/job/fresher')?{...row,body:replace(row.body)}:row)}),/identity|location|geograph/i)
  }
})

test('Trigyn rejects duplicate native identities and mismatched independent India membership',async()=>{
  for(const kind of ['duplicate','India']) {
    await assert.rejects(run({fetch:playback(row=>{
      if(row.requestBody){const scope=JSON.parse(new URLSearchParams(row.requestBody).get('param')),body=JSON.parse(row.body)
        if(kind==='duplicate'&&body.jobs?.length>1)body.jobs[1]={...body.jobs[0]}
        if(kind==='India'&&scope.country&&body.jobs?.length)body.jobs[0]={...body.jobs[0],nid:'999999',position_id:'G1026-9999',alias:'/job/alternate'}
        row.body=JSON.stringify(body)
      }return row
    })}),/duplicate|facet|identity/i)
  }
})

test('Trigyn rejects a native empty shell without numeric total rather than asserting zero',async()=>{
  await assert.rejects(run({fetch:playback(row=>row.requestBody?{...row,body:'{"jobs":[],"dropdown":{}}'}:row)}),/region|inventory|total/i)
})

test('Trigyn rejects inventory drift between complete snapshots',async()=>{
  let firstPageCalls=0
  await assert.rejects(run({fetch:playback(row=>{
    if(row.requestBody){const scope=JSON.parse(new URLSearchParams(row.requestBody).get('param'));if(scope.region==='56'&&scope.current_page==='0'&&++firstPageCalls===2){const body=JSON.parse(row.body);body.jobs[0].recruiter_title_name+=' revised';row.body=JSON.stringify(body)}}return row
  })}),/changed|drift/i)
})

test('Trigyn rejects inventory caps without manufacturing complete coverage',async()=>{
  for(const options of [{maxPages:1},{maxJobs:20}])await assert.rejects(run({...options,fetch:playback()}),/cap/i)
})

test('Trigyn rejects failed HTTP rather than reporting an empty inventory', async () => {
  await assert.rejects(run({ fetch: async () => ({status: 503, url: CAREERS_URL, text: async () => ''}) }), /HTTP|503/i)
})

test('Trigyn rejects a careers shell without an enumerable current inventory', async () => {
  await assert.rejects(run({ fetch: async () => ({status: 200, url: CAREERS_URL,
    text: async () => '<html><title>Career Opportunity | Trigyn</title><body><div id="ajax-wrapper"></div></body></html>'}) }), /inventory|listing|contract/i)
})

test('Trigyn propagates an already aborted caller without a request', async () => {
  const controller = new AbortController(), reason = Error('caller cancelled')
  controller.abort(reason)
  await assert.rejects(run({signal: controller.signal, fetch: () => { throw Error('unexpected request') }}), error => error === reason)
})

test('Trigyn bounds a noncooperative fetch with the aggregate deadline', async () => {
  await assert.rejects(run({timeoutMs: 20, fetch: () => new Promise(() => {})}), /timeout|deadline/i)
})

test('Trigyn bounds a noncooperative response body with the aggregate deadline', async () => {
  await assert.rejects(run({timeoutMs: 20, fetch: async () => ({status: 200, url: CAREERS_URL, text: () => new Promise(() => {})})}), /timeout|deadline/i)
})

test('Trigyn propagates mid-body cancellation even when the body ignores its signal', async () => {
  const controller = new AbortController(), reason = Error('caller stopped body')
  const operation = run({signal: controller.signal, fetch: async () => ({status: 200, url: CAREERS_URL,
    text: () => {controller.abort(reason); return new Promise(() => {})}})})
  await assert.rejects(operation, error => error === reason)
})

test('Trigyn rejects a successful response from another company or route', async () => {
  for (const url of ['https://example.com/careers', 'https://www.trigyn.com/']) {
    await assert.rejects(run({fetch: async () => ({status: 200, url, text: async () => '<html></html>'})}), /identity|redirect/i)
  }
})

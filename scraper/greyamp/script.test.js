import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import * as scraper from './script.js'
import {readFileSync,existsSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {spawnSync} from 'node:child_process'

const capture=name=>{
  const file=new URL('./fixtures/'+name+'.json',import.meta.url)
  return JSON.parse(existsSync(file)?readFileSync(file):gunzipSync(readFileSync(new URL(file.href+'.gz'))))
}
const captures=[capture('careers-response'),capture('application-response'),...capture('native-and-client-responses')]
const replay=(mutate=row=>row)=>async url=>{
  const saved=captures.find(r=>r.url===url);assert.ok(saved,'Uncaptured URL '+url)
  const row=mutate(structuredClone(saved)),response=new Response(row.body,{status:row.status});Object.defineProperty(response,'url',{value:row.finalUrl});return response
}

test('Greyamp inspects all three native roles and matches the employer application form',async()=>{
  assert.equal(typeof scraper.inspectInventory,'function')
  const inventory=await scraper.inspectInventory({fetchImpl:replay()})
  assert.equal(inventory.jobs.length,3)
  assert.deepEqual(inventory.jobs.map(j=>j.title),['Transformation Consultant','Data Scientist','Data Engineer'])
  assert.match(inventory.jobs[1].jobDescription,/statistical analysis/)
  assert.equal(inventory.jobs.every(j=>j.country===null&&j.postingDate===null),true)
  assert.equal(inventory.jobs[0].jobId,'6a229735-a6a3-4f52-b002-f3a491a5097e')
})
test('Greyamp reports observed roles with unknown country separately from verified empty',async()=>{
  const jobs=await run({fetchImpl:replay()})
  assert.equal(jobs.length,3)
  assert.ok(jobs.every(job=>job.country===null))
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal,3)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Greyamp rejects a native India address with a foreign state',async()=>{
  await assert.rejects(run({fetchImpl:replay(row=>{
    if(row.url.endsWith('/api/job-openings')){
      const jobs=JSON.parse(row.body);jobs.forEach(job=>{job.location='Bengaluru, India'});jobs[0].location='Bengaluru, California, India';row.body=JSON.stringify(jobs)
    }
    return row
  })}),/geographic|state/)
})

test('Greyamp upstream failures are not verified empty inventories',async()=>{
  await assert.rejects(run({fetchImpl:async()=>{throw Error('upstream unavailable')}}),/upstream unavailable/)
})
test('Greyamp cannot certify an unfamiliar HTML shell as zero vacancies',async()=>{
  await assert.rejects(run({fetchImpl:async url=>({status:200,url,text:async()=>'<title>Maintenance</title>'})}),/Greyamp/)
})
test('Greyamp preserves caller cancellation before transport',async()=>{
  const controller=new AbortController(),reason=Error('stop');controller.abort(reason)
  await assert.rejects(run({signal:controller.signal,fetchImpl:()=>assert.fail('must not fetch')}),error=>error===reason)
})
test('Greyamp bounds transports and bodies that ignore cancellation',async()=>{
  for(const fetchImpl of [()=>new Promise(()=>{}),async url=>{const r=new Response(new ReadableStream({pull(){return new Promise(()=>{})}}));Object.defineProperty(r,'url',{value:url});return r}])
    await assert.rejects(run({fetchImpl,timeoutMs:15}),/deadline|timeout/i)
})
for(const [name,mutate,pattern] of [
  ['duplicate native identities',rows=>rows.push(rows[0]),/duplicate/],
  ['new secondary geography',rows=>{rows[0].secondaryCountry='Canada'},/schema|geographic/],
  ['conflicting country labels',rows=>{rows[0].location='Toronto, Canada, India'},/geographic/],
  ['foreign application identity',rows=>{rows[0].applyLink='https://unrelated.example/apply'},/application/],
])test('Greyamp rejects '+name,async()=>{
  await assert.rejects(scraper.inspectInventory({fetchImpl:replay(row=>{
    if(row.url.endsWith('/api/job-openings')){const rows=JSON.parse(row.body);mutate(rows);row.body=JSON.stringify(rows)}
    return row
  })}),pattern)
})
test('Greyamp missing employer descriptions remain null/partial discoveries',async()=>{
  const inventory=await scraper.inspectInventory({fetchImpl:replay(row=>{
    if(row.url.endsWith('/api/job-openings')){
      const rows=JSON.parse(row.body);rows[0].description=rows[0].title;rows[0].roleOverview=['<div inert>Invisible employer content</div>'];rows[0].keyResponsibilities=['<h2>Responsibilities</h2>'];row.body=JSON.stringify(rows)
    }
    return row
  })})
  assert.equal(inventory.jobs.length,3);assert.equal(inventory.jobs[0].jobDescription,null);assert.equal(inventory.jobs[0].sourceDetailComplete,false)
})
test('Greyamp detects changed inventory clients and hidden official bindings',async()=>{
  for(const transform of [row=>{if(row.url.includes('2rrquw9a_28mi'))row.body+='/* new contract */';return row},row=>{if(row.url.endsWith('/careers'))row.body='<div inert>'+row.body+'</div>';return row}])
    await assert.rejects(run({fetchImpl:replay(transform)}),/Greyamp/)
})
test('Greyamp native zero is proved by the whole unfiltered array',async()=>{
  const jobs=await run({fetchImpl:replay(row=>{if(row.url.endsWith('/api/job-openings'))row.body='[]';return row})})
  assert.equal(readInventoryEvidence(jobs).status,'verified-empty');assert.equal(readInventoryEvidence(jobs).reportedTotal,0)
})
test('Greyamp in-flight caller abort preserves its reason',async()=>{
  const controller=new AbortController(),reason=Error('caller stop')
  const pending=run({signal:controller.signal,fetchImpl:()=>new Promise(()=>{})});controller.abort(reason)
  await assert.rejects(pending,error=>error===reason)
})
test('Greyamp --dry-run imports have no scraping or persistence side effects',()=>{
  const result=spawnSync(process.execPath,['--input-type=module','-e',"globalThis.fetch=()=>{throw Error('import fetched')}; await import('./scraper/greyamp/script.js'); console.log('import-only')",'--','--dry-run'],{encoding:'utf8'})
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'import-only')
})


test('Greyamp checks the monotonic budget after synchronous final processing',async()=>{
 await assert.rejects(scraper.inspectInventory({fetchImpl:replay(),timeoutMs:100,now:()=>{const until=performance.now()+120;while(performance.now()<until){};return '2026-10-23T13:00:00Z'}}),/deadline/)
})

test('Greyamp fresh native captures still report country gaps without certifying an empty inventory',async()=>{
 const fresh=[...capture('fresh-native-pages'),...capture('fresh-client-application'),...capture('fresh-application-page')].filter(r=>r.status===200)
 const fetchImpl=async url=>{const row=fresh.find(r=>r.url===url);assert.ok(row,'Uncaptured fresh URL '+url);const r=new Response(row.body,{status:row.status});Object.defineProperty(r,'url',{value:row.finalUrl});return r}
 const inventory=await scraper.inspectInventory({fetchImpl});assert.equal(inventory.jobs.length,3);assert.equal(inventory.unknownCountryCount,3)
 const jobs=await run({fetchImpl});assert.equal(jobs.length,3);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

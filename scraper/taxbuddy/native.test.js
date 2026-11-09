import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {run} from './script.js'
import {gunzipSync} from 'node:zlib'
const read=name=>JSON.parse(fs.readFileSync(new URL('fixtures/'+name,import.meta.url),'utf8'))
const captures=['official-home.json','native-company.json','native-jobs.json'].map(read)
const replay=(mutate=r=>r)=>async url=>{const found=captures.find(r=>r.url===url);assert.ok(found,'Uncaptured '+url);const r=mutate({...found});return{status:r.status,url:r.finalUrl,text:async()=>r.body}}
test('TaxBuddy rechecks official employer and scoped no-match without reporting company zero',async()=>{
 await assert.rejects(run({fetchImpl:replay()}),e=>{
  assert.equal(e.code,'TAXBUDDY_COVERAGE_GAP');assert.equal(e.inventoryEvidence.reportedTotal,null);assert.equal(e.inventoryEvidence.indiaFacetCount,null)
  assert.equal(e.inventoryEvidence.listingComplete,false);assert.equal(e.linkedEmployerEvidence.organizationId,'14564264');assert.equal(e.linkedEmployerEvidence.observedIndiaSearchEmpty,true)
  return true
 })
})
test('TaxBuddy blocked upstream is a typed gap',async()=>{
 await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),{code:'TAXBUDDY_COVERAGE_GAP'})
})
test('TaxBuddy exact caller abort wins even if transport ignores cancellation',async()=>{
 const c=new AbortController(),reason=Error('stop'),pending=run({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});c.abort(reason)
 await assert.rejects(pending,e=>e===reason)
})
test('TaxBuddy aggregate deadline includes a stalled body',async()=>{
 await assert.rejects(run({timeoutMs:20,fetchImpl:async url=>({status:200,url,text:()=>new Promise(()=>{})})}),{code:'TAXBUDDY_COVERAGE_GAP'})
})
for(const [label,mutate] of [
 ['hidden official employer link',r=>{if(r.url==='https://www.taxbuddy.com/')r.body=r.body.replace('href="https://www.linkedin.com/company/tax-buddy-india/"','hidden href="https://www.linkedin.com/company/tax-buddy-india/"');return r}],
 ['changed employer identity',r=>{if(r.url.includes('/company/'))r.body=r.body.replaceAll('organization:14564264','organization:999');return r}],
 ['unselected employer query',r=>{if(r.url.includes('/jobs/search/'))r.body=r.body.replaceAll('checked','unchecked');return r}],
 ['unverified redirect',r=>({...r,finalUrl:'https://unverified.example/'})],
 ['oversized body',r=>({...r,body:'x'.repeat(5000001)})],
])test(`TaxBuddy refuses ${label}`,async()=>{
 await assert.rejects(run({fetchImpl:replay(mutate)}),e=>e.code==='TAXBUDDY_COVERAGE_GAP'&&e.linkedEmployerEvidence===null&&e.inventoryEvidence.reportedTotal===null)
})
test('TaxBuddy import with dry-run flag never collects or persists',()=>{
 const url=new URL('./script.js',import.meta.url).href
 const child=spawnSync(process.execPath,['--input-type=module','-e',`process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected network')};await import(${JSON.stringify(url)});console.log('safe')`],{encoding:'utf8',timeout:5000})
 assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'safe')
})


test('TaxBuddy fresh homepage and employer receipts preserve scoped observations with unknown company totals',async()=>{
 const rows=['fresh-official-page','fresh-native-employer'].flatMap(name=>JSON.parse(gunzipSync(fs.readFileSync(new URL(`fixtures/${name}.json.gz`,import.meta.url)))))
 const fetchImpl=async url=>{const row=rows.find(r=>r.url===url);assert.ok(row,'Uncaptured fresh URL '+url);const response=new Response(row.body,{status:row.status});Object.defineProperty(response,'url',{value:row.finalUrl});return response}
 await assert.rejects(run({fetchImpl}),e=>{assert.equal(e.code,'TAXBUDDY_COVERAGE_GAP');assert.equal(e.linkedEmployerEvidence.organizationId,'14564264');assert.equal(e.linkedEmployerEvidence.observedIndiaSearchEmpty,true);assert.equal(e.inventoryEvidence.listingComplete,false);assert.equal(e.inventoryEvidence.reportedTotal,null);return true})
})

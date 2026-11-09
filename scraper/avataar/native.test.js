import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {run} from './script.js'
const read=name=>JSON.parse(fs.readFileSync(new URL('fixtures/'+name,import.meta.url),'utf8'))
const captures=[read('official-home.json'),read('native-company.json'),...read('native-jobs.json')]
const response=(body,status,url)=>Object.defineProperty(new Response(body,{status}),'url',{value:url})
const replay=(mutate=r=>r)=>async url=>{const found=captures.find(r=>r.url===url);assert.ok(found,'Uncaptured '+url);const r=mutate({...found});return response(r.body,r.status,r.finalUrl)}
test('Avataar inspects official employer and scoped native empty without company-wide zero',async()=>{
 await assert.rejects(run({fetchImpl:replay()}),e=>{
  assert.equal(e.code,'AVATAAR_COVERAGE_GAP')
  assert.equal(e.inventoryEvidence.listingComplete,false)
  assert.equal(e.inventoryEvidence.reportedTotal,null)
  assert.equal(e.inventoryEvidence.indiaFacetCount,null)
  assert.equal(e.linkedEmployerEvidence.organizationId,'13195422')
  assert.equal(e.linkedEmployerEvidence.observedIndiaSearchEmpty,true)
  assert.equal(e.retainedResponses.length,3)
  return true
 })
})
test('Avataar inaccessible upstream never becomes verified empty',async()=>{
 await assert.rejects(run({fetchImpl:async url=>({status:403,url,text:async()=>'<h1>Forbidden</h1>'})}),{code:'AVATAAR_COVERAGE_GAP'})
})
test('Avataar exact caller abort defeats uncooperative fetch',async()=>{
 const c=new AbortController(),reason=Error('stop'),pending=run({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});c.abort(reason)
 await assert.rejects(pending,e=>e===reason)
})
test('Avataar aggregate deadline includes response body',async()=>{
 await assert.rejects(run({timeoutMs:20,fetchImpl:async url=>response(new ReadableStream({pull(){return new Promise(()=>{})}}),200,url)}),e=>e.code==='AVATAAR_COVERAGE_GAP'&&/deadline/.test(e.cause?.message))
})
for(const [label,mutate] of [
 ['hidden official handoff',r=>{if(r.url==='https://www.avataar.ai/')r.body=r.body.replace('href="https://www.linkedin.com/company/avataar-/"','hidden href="https://www.linkedin.com/company/avataar-/"');return r}],
 ['changed organization',r=>{if(r.url.includes('/company/'))r.body=r.body.replaceAll('organization:13195422','organization:999');return r}],
 ['unselected employer filter',r=>{if(r.url.includes('/jobs/search/'))r.body=r.body.replaceAll('checked','unchecked');return r}],
 ['unverified redirect',r=>({...r,finalUrl:'https://unverified.example/'})],
 ['oversized body',r=>({...r,body:'x'.repeat(5000001)})],
])test(`Avataar refuses ${label} as recruiting evidence`,async()=>{
 await assert.rejects(run({fetchImpl:replay(mutate)}),e=>e.code==='AVATAAR_COVERAGE_GAP'&&e.linkedEmployerEvidence===null&&e.inventoryEvidence.reportedTotal===null)
})
test('Avataar import with dry-run flag performs no collection or persistence',()=>{
 const url=new URL('./script.js',import.meta.url).href
 const child=spawnSync(process.execPath,['--input-type=module','-e',`process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected network')};await import(${JSON.stringify(url)});console.log('safe')`],{encoding:'utf8',timeout:5000})
 assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'safe')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {run} from './script.js'

const captured=JSON.parse(readFileSync(new URL('./fixtures/official-careers.json',import.meta.url)))
const company=JSON.parse(readFileSync(new URL('./fixtures/native-company.json',import.meta.url)))
const native=JSON.parse(readFileSync(new URL('./fixtures/native-jobs.json',import.meta.url)))
const replay=(body=captured.body,mutate=r=>r)=>async url=>{
  const found=url===captured.url?{...captured,body}:[company,...native].find(r=>r.url===url)
  assert.ok(found,'Uncaptured '+url)
  const r=mutate({...found});return {status:r.status,url:r.finalUrl,text:async()=>r.body}
}
const unknown=e=>e.code==='SYNUP_COVERAGE_GAP'&&e.inventoryEvidence.reportedTotal===null
  &&e.inventoryEvidence.indiaFacetCount===null&&e.inventoryEvidence.listingComplete===false
  &&e.sourceScopeComplete===false&&e.lifecycleCleanupAllowed===false

test('Synup performs current official handoff discovery instead of unconditional empty success',async()=>{
  await assert.rejects(run({fetchImpl:replay()}),e=>{
    assert.ok(unknown(e));assert.equal(e.inventoryEvidence.firstParty,true)
    assert.equal(e.delegatedEmployerUrl,'https://www.linkedin.com/company/synup/jobs/')
    assert.equal(e.retainedResponses.length,4)
    assert.equal(e.linkedEmployerEvidence.organizationId,'9322483')
    assert.equal(e.linkedEmployerEvidence.observedIndiaSearchEmpty,true)
    assert.equal(e.linkedEmployerEvidence.wholeCompanyInventoryVerified,false)
    assert.equal(e.retainedResponses[0].body,captured.body)
    assert.match(e.retainedResponses[0].bodySHA256,/^[a-f0-9]{64}$/)
    return true
  })
})

test('Synup inaccessible native surface is a coverage gap',async()=>{
  await assert.rejects(run({fetchImpl:async url=>({status:503,url,text:async()=>'<h1>Unavailable</h1>'})}),unknown)
})

test('Synup exact caller cancellation is preserved before fetch and during noncooperative fetch/body',async()=>{
  for(const stage of ['before','fetch','body']){
    const c=new AbortController(),reason=Error('stop '+stage)
    let enteredBody
    const bodyStarted=new Promise(resolve=>{enteredBody=resolve})
    if(stage==='before')c.abort(reason)
    const pending=run({signal:c.signal,fetchImpl:stage==='before'?()=>assert.fail('fetch after abort'):
      stage==='fetch'?()=>new Promise(()=>{}):async url=>({status:200,url,text:()=>{enteredBody();return new Promise(()=>{})}})})
    if(stage==='body')await bodyStarted
    if(stage!=='before')c.abort(reason)
    await assert.rejects(pending,e=>e===reason)
  }
})

test('Synup aggregate deadline bounds uncooperative fetch and body',async()=>{
  for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({status:200,url,text:()=>new Promise(()=>{})})])
    await assert.rejects(run({fetchImpl,timeoutMs:15}),unknown)
})

for(const [name,mutate] of [
  ['hidden handoff',html=>html.replaceAll('href="https://www.linkedin.com/company/synup/jobs/"','hidden href="https://www.linkedin.com/company/synup/jobs/"')],
  ['template-only identity',html=>'<template>'+html+'</template>'],
  ['comment-only identity',html=>'<!--'+html+'-->'],
  ['changed canonical',html=>html.replace('rel="canonical" href="https://synup.com/careers"','rel="canonical" href="https://untrusted.example/careers"')],
  ['new employer delegation',html=>html.replaceAll('https://www.linkedin.com/company/synup/jobs/','https://www.linkedin.com/company/another/jobs/')],
  ['oversized response',()=> 'x'.repeat(5000001)],
])test('Synup rejects '+name,async()=>{
  await assert.rejects(run({fetchImpl:replay(mutate(captured.body))}),e=>unknown(e)&&!e.delegatedEmployerUrl)
})

test('Synup rejects final URL changes before reading untrusted body',async()=>{
  await assert.rejects(run({fetchImpl:async()=>({status:200,url:'https://untrusted.example/careers',text:()=>assert.fail('untrusted body read')})}),unknown)
})

for(const [name,mutate] of [
  ['changed organization',r=>({...r,body:r.url===company.url?r.body.replaceAll('organization:9322483','organization:999'):r.body})],
  ['unselected employer filter',r=>({...r,body:r.url===native[0].url?r.body.replaceAll('checked','unchecked'):r.body})],
  ['changed no-match heading',r=>({...r,body:r.url===native[0].url?r.body.replace('Jobs jobs in India','Jobs jobs in Singapore'):r.body})],
  ['guest populated after no-match',r=>({...r,body:r.url===native[1].url?'<li>new job</li>':r.body})],
])test('Synup refuses '+name+' as scoped empty evidence',async()=>{
  await assert.rejects(run({fetchImpl:replay(captured.body,mutate)}),e=>unknown(e)&&!e.linkedEmployerEvidence)
})

test('Synup raw response artifacts retain verifiable exact body bytes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
  assert.equal(manifest.captures.length,4)
  for(const row of manifest.captures){
    const gzip=readFileSync(new URL('./fixtures/'+row.rawBodyFile,import.meta.url)),body=gunzipSync(gzip)
    const original=[captured,company,...native].find(r=>r.url===row.url)
    assert.equal(body.toString(),original.body)
    assert.equal(body.length,row.bodyBytes)
    assert.equal(createHash('sha256').update(body).digest('hex'),row.bodySHA256)
    assert.equal(createHash('sha256').update(gzip).digest('hex'),row.gzipSHA256)
  }
})

test('Synup import performs no fetch or persistence with dry-run flags',()=>{
  const child=spawnSync(process.execPath,['--input-type=module','-e',`process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected fetch')};await import(${JSON.stringify(new URL('./script.js',import.meta.url).href)});console.log('safe')`],{encoding:'utf8',timeout:5000})
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'safe')
})

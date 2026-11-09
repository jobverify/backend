import test from 'node:test'
import assert from 'node:assert/strict'
import {run,FIRST_PARTY_ROOT_URL} from './script.js'
import {readFileSync,readdirSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {activeDocument,collectNative,HANDOFF_URL,ENTRY_URL} from './native.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const gap=e=>{assert.equal(e.code,'DASSAULTAVIATIONINDIA_COVERAGE_GAP');assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(e.inventoryEvidence.reportedTotal,null);return true}
test('Dassault unavailable native inventory is not a successful zero',async()=>{
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)
})
test('Dassault aggregate deadline bounds fetch and response body stalls',async()=>{
  for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,text:()=>new Promise(()=>{})})])await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)
})
test('Dassault exact caller abort reason propagates',async()=>{
  for(const stage of ['before','fetch','body']){const c=new AbortController(),reason={stage};if(stage==='before')c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async url=>{if(stage==='fetch'){c.abort(reason);return new Promise(()=>{})}return{url,status:200,text:()=>{c.abort(reason);return new Promise(()=>{})}}}}),e=>e===reason)}
})
const fixtureDir=new URL('./fixtures/',import.meta.url)
const shell=JSON.parse(readFileSync(new URL('incapsula-corporate-shell.json',fixtureDir)))
const shellRun=(body=shell.body,requests=[])=>run({now:()=>shell.capturedAt,fetchImpl:async url=>{
  requests.push(url)
  assert.equal(url,FIRST_PARTY_ROOT_URL,'The blocked publisher cannot delegate native inventory reads')
  return{url:shell.finalUrl,status:shell.status,text:async()=>body}
}})

test('observed HTTP200 Incapsula corporate shell produces structured blocked diagnostics without a current binding or inventory count',async()=>{
  const requests=[]
  const error=await shellRun(shell.body,requests).catch(e=>e)
  assert.ok(error instanceof Error)
  gap(error)
  assert.equal(error.softFailure,true)
  assert.equal(error.upstreamOutage,true)
  assert.equal(error.failureKind,'blocked_or_access_denied')
  assert.equal(error.stage,'corporate')
  assert.equal(error.status,200)
  assert.equal(error.statusCode,200)
  assert.equal(error.requestUrl,shell.url)
  assert.equal(error.finalUrl,shell.finalUrl)
  assert.equal(error.inventoryEvidence.firstParty,false)
  assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.deepEqual(requests,[FIRST_PARTY_ROOT_URL])
  const {classifyScraperError,applyRetryPolicyToScraperError,isHardSourceFailure}=await import('../../scraper-support/runner.js')
  assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'})
  assert.equal(applyRetryPolicyToScraperError(error),error)
  assert.equal(error.abortRetries,true)
  assert.equal(isHardSourceFailure({success:false,...classifyScraperError(error)}),false)
})

test('ordinary successful HTML missing Dassault employer identity remains a hard contract gap',async()=>{
  const error=await shellRun('<title>Other careers</title><h1>Other employer</h1>').catch(e=>e)
  gap(error)
  assert.match(error.message,/Corporate employer identity missing/)
  assert.notEqual(error.softFailure,true)
  const {classifyScraperError,isHardSourceFailure}=await import('../../scraper-support/runner.js')
  assert.deepEqual(classifyScraperError(error),{softFailure:false,upstreamOutage:false,failureKind:'hard_failure'})
  assert.equal(isHardSourceFailure({success:false,...classifyScraperError(error)}),true)
})

test('Incapsula diagnostic requires the observed active compound shell rather than inert or unrelated resource lookalikes',async()=>{
  for(const change of [
    body=>body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/i,m=>'<!--'+m+'-->'),
    body=>body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/i,m=>'<template>'+m+'</template>'),
    body=>body.replace('<META NAME="ROBOTS"','<META hidden NAME="ROBOTS"'),
    body=>body.replace('NOINDEX, NOFOLLOW','NOINDEX'),
    body=>body.replace('<iframe ','<iframe hidden '),
    body=>body.replace('<iframe ','<iframe srcdoc="" '),
    body=>body.replace('<iframe ','<template><iframe ').replace('</iframe>','</iframe></template>'),
    body=>body.replaceAll('src="/_Incapsula_Resource','src="https://other.example/_Incapsula_Resource'),
    body=>body.replace('</body>','<h1>Other employer careers</h1></body>'),
  ]){
    const error=await shellRun(change(shell.body)).catch(e=>e)
    gap(error)
    assert.match(error.message,/Corporate employer identity missing/)
    assert.notEqual(error.softFailure,true)
    assert.notEqual(error.failureKind,'blocked_or_access_denied')
  }
})
const rows=readdirSync(fixtureDir).filter(f=>/^(official-careers|native-careers|native-listing-pages|native-job-details-\d+)\.json\.gz$/.test(f)).flatMap(f=>{const p=JSON.parse(gunzipSync(readFileSync(new URL(f,fixtureDir))));return Array.isArray(p)?p:[p]})
const replay=(mutate=r=>r)=>async url=>{
  // Redirect branch here is an injected HTTP contract test; original redirect
  // observations remain separate from the captured native response envelopes.
  if(url===HANDOFF_URL)return{url,status:301,headers:{get:key=>key==='location'?ENTRY_URL:null}}
  const found=rows.find(r=>r.url===url);assert.ok(found,'Unexpected native request '+url)
  const r=mutate({...found});return{url:r.finalUrl,status:r.status,text:async()=>r.body}
}
test('all 11 current pages and 103 role details reconcile without relabeling parent jobs as India jobs',async()=>{
  const jobs=await run({fetchImpl:replay()})
  assert.deepEqual(jobs,[])
  const e=readInventoryEvidence(jobs),n=jobs.nativeCollectionEvidence
  assert.equal(e.status,'discovery-only');assert.equal(e.reportedTotal,null);assert.equal(e.listingComplete,false)
  assert.equal(n.nativePublicJobCount,103);assert.equal(n.nativePagesFetched,11);assert.equal(n.exclusions.length,103)
  assert.equal(n.nativePrimaryIndiaJobCount,0);assert.equal(n.nativeIndiaJobCount,null)
  assert.equal(n.exactSubsidiaryScopeComplete,false)
  const prospective=n.exclusions.find(r=>r.id==='15678')
  assert.equal(prospective.countryScopeComplete,false);assert.match(prospective.nativeSecondaryCountryMentions[0],/expatriation en Inde/)
  assert.equal(n.exclusions.find(r=>r.id==='15839').postingDate,'2026-10-21')
  assert.equal(n.exclusions.find(r=>r.id==='15839').nativeListingPublicationDate,'2026-10-23')
})
test('missing page, stale total, changed detail country, hidden location and secondary India scope cannot certify a zero',async()=>{
  const first=rows.find(r=>r.url.includes('emploi-cdd-acheteur-systemes'))
  for(const mutate of [r=>r.url.includes('page=2&')?{...r,status:503}:r,
    r=>r.url.includes('liste-toutes-offres')?{...r,body:r.body.replaceAll('103 offre(s)','104 offre(s)')}:r,
    r=>r.url===first.url?{...r,body:r.body.replace('France, Nouvelle Aquitaine','India, Karnataka')}:r,
    r=>r.url===first.url?{...r,body:r.body.replace('>France, Nouvelle Aquitaine',' hidden>France, Nouvelle Aquitaine')}:r,
    r=>r.url===first.url?{...r,body:r.body.replace('Informations générales','Informations générales').replace('Dans le cadre','Poste en Inde. Dans le cadre')}:r]){
    await assert.rejects(run({fetchImpl:replay(mutate)}),gap)
  }
})
test('corporate hidden/template handoffs and redirect host drift fail closed',async()=>{
  const official=rows.find(r=>r.url.includes('/en/group/careers/'))
  for(const wrap of [s=>'<template>'+s+'</template>',s=>'<div hidden>'+s+'</div>',s=>'<!--'+s+'-->']){
    await assert.rejects(run({fetchImpl:replay(r=>r.url===official.url?{...r,body:r.body.replace(/<a\b[^>]*href="https:\/\/carriere\.dassault-aviation\.com\/accueil\.aspx\?LCID=1036"[^>]*>[\s\S]*?<\/a>/g,wrap)}:r)}),gap)
  }
  await assert.rejects(run({fetchImpl:async url=>url===HANDOFF_URL?{url,status:301,headers:{get:()=> 'https://example.com/jobs'}}:replay()(url)}),gap)
})
test('stream byte bounds and stalled-reader deadline cancel the reader',async()=>{
  for(const oversize of [true,false]){let cancelled=false;await assert.rejects(run({timeoutMs:15,fetchImpl:async url=>({url,status:200,body:{getReader:()=>({read:()=>oversize?Promise.resolve({value:new Uint8Array(3000001),done:false}):new Promise(()=>{}),cancel:async()=>{cancelled=true},releaseLock:()=>{}})}})}),gap);assert.equal(cancelled,true)}
})
test('original native captured envelopes retain exact gzip, raw and body hashes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('capture-manifest.json',fixtureDir))),sha=v=>createHash('sha256').update(v).digest('hex')
  assert.equal(manifest.redirectReplay.rawResponseCaptured,false)
  for(const item of manifest.evidence){const gz=readFileSync(new URL(item.file,fixtureDir)),raw=gunzipSync(gz);assert.equal(sha(gz),item.sha256);assert.equal(sha(raw),item.uncompressedSha256);const p=JSON.parse(raw),rs=Array.isArray(p)?p:[p];for(const r of item.responses)assert.equal(sha(rs.find(x=>x.url===r.url).body),r.bodySHA256)}
})

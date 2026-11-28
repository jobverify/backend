import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {extractSearchConfiguration,JOBS_SEARCH_URL,run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-programs-20261128.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-held-20261117.json.gz',import.meta.url))))
const html=fixture.page.body
const sha=value=>createHash('sha256').update(value).digest('hex')
const expected={apiBaseUrl:'https://jobsapi-internal.m-cloud.io/api/',organizationId:'2030',
  filters:['ats_portalid:Workday-MuleAPI-External','is_internal:allstate_careers'],limit:10}

test('genuine current publisher fixture retains exact search page and all three declared full programs',()=>{
  assert.equal(fixture.capturedPageOutcomeSHA256,'40221d73d8f5632890dcf38a0c32391b188c59cd5121537d1ad36249592de3a1')
  assert.equal(fixture.page.requestedUrl,JOBS_SEARCH_URL);assert.equal(fixture.page.url,JOBS_SEARCH_URL)
  assert.equal(fixture.page.status,200);assert.equal(Buffer.byteLength(html),194422)
  assert.equal(sha(html),'356c9a1c64b5438732e29fd44f41b54ea783fa048505921bbe0cb0a9cdc7b9f9')
  assert.equal(fixture.declaredPrograms.length,3)
  for(const [index,packet] of fixture.declaredPrograms.entries()){
    assert.equal(packet.status,200);assert.equal(packet.requestedUrl,packet.url)
    assert.equal(new URL(packet.url).origin,'https://www.allstate.jobs');assert.ok(html.includes(packet.url))
    assert.equal(sha(packet.body),packet.sha256)
    assert.equal(Buffer.byteLength(packet.body),[71338,133781,168729][index])
  }
})

test('exact genuine current declaration plan reaches the same fixed employer/API and external Workday facets',()=>{
  assert.deepEqual(extractSearchConfiguration(html),expected)
})

// These complete historical native rows/details are compatibility controls,
// explicitly paired with the genuine current publisher. They are not current
// vacancy observations; the separate actual registered capture supplies those.
async function historicalReplay({changePage=value=>value,changeApi=value=>value,signal}={}){
  let index=0,apiReads=0,pageReads=0
  const requests=[]
  const read=async(url,options)=>{
    assert.equal(options.signal,signal);requests.push(url)
    const packet=historical.requests[index++]
    assert.ok(packet,'No read outside retained historical capture');assert.equal(url,packet.requestedURL)
    if(url===JOBS_SEARCH_URL)return changePage(html,++pageReads)
    const value=Buffer.from(packet.bodyBase64,'base64').toString('utf8')
    return url.startsWith(expected.apiBaseUrl)?changeApi(value,++apiReads):value
  }
  return{jobs:await run({fetchText:read,fetchJsonpText:read,signal}),requests,index}
}

test('current declaration plan preserves complete historical native details and blank-application holds through both raw snapshots',async()=>{
  const {jobs,requests,index}=await historicalReplay()
  assert.equal(index,12);assert.equal(requests.length,12);assert.equal(jobs.length,8)
  const evidence=jobs.nativeCollectionEvidence
  assert.equal(evidence.closingRawRowsMatch,true);assert.deepEqual(evidence.openingRawRows,evidence.closingRawRows)
  assert.equal(evidence.openingRawRows.length,10);assert.equal(evidence.heldNativeRecords.length,2)
  for(const job of jobs){
    const row=evidence.openingRawRows.find(row=>row.ref===job.jobId)
    assert.deepEqual(job.sourceNativeDetailPayload,row);assert.equal(job.sourceDescription,row.description)
    assert.equal(job.sourceDetailComplete,true);assert.equal(job.country,'India');assert.equal(job.countryCode,'IN')
    assert.equal(job.sourceScopeComplete,false);assert.equal(job.companyInventoryComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  const assessed=assessSoftFailureAcquisition({source:'allstate',companyName:'Allstate'},jobs)
  assert.equal(assessed.runnerOutcome.rawRecords,10);assert.equal(assessed.runnerOutcome.partial,true)
  assert.deepEqual(assessed.cleanupOptions,{replaceExisting:false})
})

test('current declaration plan synthetic coherent zero needs both snapshots and retains company/cleanup holds',async()=>{
  const calls=[]
  const read=async url=>{
    calls.push(url)
    return url===JOBS_SEARCH_URL?html:'jobverifyAllstateCallback({"totalHits":0,"queryResult":[]})'
  }
  const jobs=await run({fetchText:read,fetchJsonpText:read})
  assert.equal(calls.length,4);assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.companyInventoryComplete,false)
})

for(const [name,change] of [
  ['an unreviewed client version',value=>value.replaceAll('ver=4.5.4-317','ver=4.5.4-318')],
  ['a current client activation attribute',value=>value.replace('id="cws-jobs-js"','id="cws-jobs-js" nomodule')],
  ['replaced API literal',value=>value.replaceAll('CWS.jobs.set_api("https://jobsapi-internal.m-cloud.io/api/")','CWS.jobs.set_api("https://foreign.invalid/api/")')],
  ['a dormant ready program',value=>value.replace('jQuery(document).ready(function(){if(CWS && CWS.jobs){','function neverCalled(){jQuery(document).ready(function(){if(CWS && CWS.jobs){')],
  ['an extra computed override',value=>value.replace('</body>','<script>CWS.jobs["set_options"]({org_id:"9999"})</script></body>')],
  ['a changed telemetry literal',value=>value.replace('"applicationTime":4','"applicationTime":999')],
  ['a changed passive schema',value=>value.replaceAll('Search for jobs countrywide','Search for jobs at another employer')],
  ['inert-only publisher markup',value=>'<template>'+value+'</template>'],
])test('the finite current declaration profile rejects '+name,()=>{
  const changed=change(html);assert.notEqual(changed,html,'Control must actually mutate genuine HTML')
  assert.throws(()=>extractSearchConfiguration(changed),/Allstate/)
})

test('an unreviewed closing declaration cannot commit otherwise valid historical opening models',async()=>{
  let reachedClosing=false
  await assert.rejects(historicalReplay({changePage:(value,count)=>{
    if(count!==2)return value
    reachedClosing=true
    return value.replaceAll('ver=4.5.4-317','ver=4.5.4-999')
  }}),/Allstate public search program/)
  assert.equal(reachedClosing,true)
})

test('current profile preserves complete closing raw-row drift rejection',async()=>{
  let changedClosing=false
  await assert.rejects(historicalReplay({changeApi:(value,count)=>{
    if(count!==2)return value
    const changed=value.replace('"primary_country":"IN"','"primary_country":"US"')
    assert.notEqual(changed,value);changedClosing=true
    return changed
  }}),/Allstate/)
  assert.equal(changedClosing,true)
})

test('a pre-aborted current publisher run retains exact opaque reason and performs no reads',async()=>{
  let reads=0;const reason={caller:'allstate current profile control'}
  await assert.rejects(run({signal:AbortSignal.abort(reason),fetchText:async()=>{reads++;return html}}),value=>value===reason)
  assert.equal(reads,0)
})

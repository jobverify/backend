import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'
const backend=process.cwd(),{parseDetail}=await import(pathToFileURL(path.join(backend,'scraper/enphaseenergy.workday/native.js'))),availability=await import(pathToFileURL(path.join(backend,'scraper-support/utils/sourceAvailability.js'))),{analyzePublishableJobs}=await import(pathToFileURL(path.join(backend,'scraper-support/utils/publishableJobMetrics.js')))
const packet=fs.readFileSync(path.join(backend,'scraper/enphaseenergy.workday/fixtures/native-002.json.gz'));assert.equal(createHash('sha256').update(packet).digest('hex'),'c4b0583328c69c7f56a90f2e89038c299b57ddff58ce859299a37231e3ccfc27')
const fixture=JSON.parse(gunzipSync(packet)),row=fixture.receipts.filter(receipt=>receipt.kind.startsWith('listing-page-')).flatMap(receipt=>JSON.parse(receipt.storedBodyUTF8).rows).find(row=>row.jid==='o9tUAfwQ'),html=fixture.receipts.find(receipt=>receipt.kind==='india-detail-'+row.jid).storedBodyUTF8,now='2026-10-21T18:03:29.228Z',intro='<div class="jobvite-detail__intro">'
assert.equal(html.split(intro).length,2)
const execute=evidenceHTML=>{const job=parseDetail(evidenceHTML,structuredClone(row),{now}),proof=availability.readNativeRoleAvailability(job),metrics=analyzePublishableJobs([job],{now:new Date(now)});assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeDescriptionOriginal,row.description__value);assert.equal(job.scrapedAt,now);return{job,proof,metrics}}
test('retained Enphase healthy role keeps validated open at its actual historical clock',()=>{const{job,proof,metrics}=execute(html);assert.equal(job.jobId,row.jid);assert.equal(proof.state,'open');assert.equal(proof.validated,true);assert.equal(proof.observedAt,now);assert.equal(metrics.eligibleJobs.length,1);assert.equal(metrics.filterCounts.closed,0)})
const cases=[
 ['unknown duplicate header closed','<di.v class="jobvite-detail__intro"><p>This position is closed.</p></di.v>'+intro],
 ['unknown duplicate header open','<di.v class="jobvite-detail__intro"><p>Applications are open.</p></di.v>'+intro],
 ['unknown duplicate header empty','<di.v class="jobvite-detail__intro"><p>No open positions.</p></di.v>'+intro],
 ['unknown ancestor of duplicate header','<di.v><div class="jobvite-detail__intro"><p>This position is closed.</p></div></di.v>'+intro],
 ['unknown duplicate header with literal hiding','<di.v class="jobvite-detail__intro" style="display:none"><p>This position is closed.</p></di.v>'+intro],
 ['unknown duplicate description','<di.v class="jobvite-detail__content"><p>This position is closed.</p></di.v>'+intro],
 ['unknown nested closure',intro+'<di.v><p>This position is closed.</p></di.v>'],
]
for(const[name,replacement]of cases)test('bound unqualified status scope preserves facts and withholds eligibility: '+name,()=>{const evidenceHTML=html.replace(intro,replacement),{job,proof,metrics}=execute(evidenceHTML);assert.equal(job.jobId,row.jid);assert.equal(job.sourceAvailabilityEvidence?.state,'unavailable');assert.equal(proof.state,'unavailable');assert.equal(metrics.eligibleJobs.length,0);assert.equal(metrics.filterCounts.unavailable,1);assert.equal(metrics.filterCounts.closed,0);for(const state of ['open','closed'])assert.throws(()=>availability.createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:evidenceHTML}),{code:'NATIVE_STATUS_LAYOUT_UNQUALIFIED'})})
test('known duplicate header keeps its existing generic identity-scope rejection',()=>{const evidenceHTML=html.replace(intro,'<div class="jobvite-detail__intro"><p>Other ordinary header.</p></div>'+intro),{job}=execute(html);assert.throws(()=>parseDetail(evidenceHTML,structuredClone(row),{now}),/Missing or ambiguous active role intro/);for(const state of ['open','closed'])assert.throws(()=>availability.createNativeRoleAvailability(job,{state,observedAt:now,evidenceHtml:evidenceHTML}),error=>error.code===undefined&&/native role header scope is missing or ambiguous/.test(error.message))})
test('inert template unknown carrier cannot replace the healthy native scope',()=>{const evidenceHTML=html.replace(intro,'<template><di.v class="jobvite-detail__intro"><p>This position is closed.</p></di.v></template>'+intro),{proof,metrics}=execute(evidenceHTML);assert.equal(proof.state,'open');assert.equal(proof.validated,true);assert.equal(metrics.eligibleJobs.length,1)})
test('unrelated employer remains rejected before scoped layout handling',()=>{const{job}=execute(html),evidenceHTML=html.replace(intro,cases[0][1]);assert.throws(()=>availability.createNativeRoleAvailability({...job,company:'Unrelated Employer'},{state:'open',observedAt:now,evidenceHtml:evidenceHTML}),error=>error.code===undefined&&/source\/native role\/title\/brand is unqualified/.test(error.message))})

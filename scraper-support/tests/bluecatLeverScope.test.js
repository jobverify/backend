import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {run} from '../../scraper/bluecat/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const actual=JSON.parse(fs.readFileSync(new URL('./fixtures/bluecat/native.json',import.meta.url)))
const options=rows=>({now:()=> '2026-10-20T23:00:00.000Z',fetchJson:async url=>{assert.equal(url,'https://api.lever.co/v0/postings/bluecatnetworks?mode=json');return rows}})
test('current26 explicit foreign primary and secondary scopes reconcile zero India without empty-global claims',async()=>{
  const jobs=await run(options(structuredClone(actual)))
  assert.equal(jobs.length,0)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,'complete-inventory')
  assert.equal(evidence.reportedTotal,26)
  assert.equal(evidence.indiaFacetCount,0)
  assert.equal(evidence.listingComplete,true)
})
test('selects secondary India while retaining original foreign primary evidence and full native body',async()=>{
  const rows=structuredClone(actual)
  rows[2].categories.allLocations.push('Bengaluru, India')
  const before=structuredClone(rows)
  const jobs=await run(options(rows))
  assert.equal(jobs.length,1)
  const job=jobs[0]
  assert.equal(job.jobId,rows[2].id)
  assert.equal(job.location,'Bengaluru, India')
  assert.equal(job.nativePrimaryCountry,'CR')
  assert.equal(job.nativePrimaryLocation,'Costa Rica - Remote')
  assert.deepEqual(job.nativeAllLocations,['Costa Rica - Remote','Bengaluru, India'])
  assert.match(job.jobDescription,/As a Customer Success Manager/)
  assert.ok(job.jobDescription.length>rows[2].descriptionPlain.length)
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,26)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.deepEqual(rows,before,'Normalized selected-country projection must not change native primary-country or office evidence')
})
test('explicit native IN country selects a city beyond the shared primary city allowlist',async()=>{
  const rows=structuredClone(actual)
  rows[0].country='IN';rows[0].categories.location='Jaipur';rows[0].categories.allLocations=['Jaipur']
  const jobs=await run(options(rows))
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].nativePrimaryCountry,'IN')
  assert.equal(jobs[0].location,'Jaipur')
})
for(const [label,mutate] of [
  ['unknown global scope',r=>{r[0].categories.location='Remote';r[0].categories.allLocations=['Remote'];delete r[0].country}],
  ['unknown secondary scope',r=>r[0].categories.allLocations.push('Anywhere')],
  ['malformed secondary',r=>r[0].categories.allLocations.push({location:'India'})],
  ['missing secondary inventory',r=>delete r[0].categories.allLocations],
  ['country contradiction',r=>{r[0].categories.location='Bengaluru, India';r[0].categories.allLocations=['Bengaluru, India']}],
  ['duplicate ID',r=>r.push(structuredClone(r[0]))],
  ['malformed role ID',r=>{r[0].id='-'.repeat(36);r[0].hostedUrl='https://jobs.lever.co/bluecatnetworks/'+r[0].id;r[0].applyUrl=r[0].hostedUrl+'/apply'}],
  ['wrong board apply',r=>r[0].applyUrl=r[0].applyUrl.replace('/bluecatnetworks/','/other/')],
  ['future publication',r=>r[0].createdAt=Date.parse('2099-01-01T00:00:00Z')],
])test(`fails closed for ${label}`,async()=>{const rows=structuredClone(actual);mutate(rows);await assert.rejects(run(options(rows)))})
test('missing native role body cannot inherit employer introduction as full JD',async()=>{
  const rows=structuredClone(actual)
  rows[2].categories.allLocations.push('Bengaluru, India')
  rows[2].descriptionBody='<template><p>fake role content</p></template>'
  rows[2].descriptionBodyPlain=''
  const jobs=await run(options(rows))
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].jobDescription,null)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('HTTP200 malformed envelopes and abort never certify zero',async()=>{
  await assert.rejects(run(options({error:'unavailable'})))
  await assert.rejects(run({...options(actual),signal:AbortSignal.abort()}))
})
for (const label of ['Global Remote','USA - Global Remote','Worldwide / USA','USA - Work Anywhere',
  'Distributed - USA','Any-location / USA','USA (any location)','USA - globally remote']) {
  for (const field of ['primary','secondary']) test(`rejects broad ${field} scope ${label} despite typed US country`,async()=>{
    const rows=structuredClone(actual)
    if(field==='primary') {rows[0].categories.location=label;rows[0].categories.allLocations=[label]}
    else rows[0].categories.allLocations.push(label)
    await assert.rejects(run(options(rows)))
  })
}
test('broad composite scope without typed country also remains unavailable',async()=>{
  const rows=structuredClone(actual)
  rows[0].categories.location='Global Remote';rows[0].categories.allLocations=['Global Remote'];delete rows[0].country
  await assert.rejects(run(options(rows)))
})
test('bounded native country office/remote labels remain valid',async()=>{
  const rows=structuredClone(actual)
  rows[0].categories.location='Remote - USA';rows[0].categories.allLocations=['Remote - USA','Toronto Office']
  const jobs=await run(options(rows))
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,26)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

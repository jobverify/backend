import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractSearchResults,run,JOBS_API_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))[0]
const records=JSON.parse(packet.body)
test('actual Ammachi records preserve native title/address geography without manufacturing country for21 absent workplaces',()=>{
 const jobs=extractSearchResults(records)
 assert.equal(jobs.length,23);assert.equal(jobs.filter(j=>j.location===null).length,21)
 assert.ok(jobs.every(j=>j.country===null))
 assert.equal(jobs[0].location,'Wayanad district, Kerala');assert.equal(jobs[0].postingDate,'2026-05-26T04:41:14.000Z')
 assert.ok(jobs.every(j=>j.jobDescription&&j.sourceUrl===records.find(r=>String(r.id)===j.jobId).link))
})
import {nativeFixture} from '../alohatechnology/nativeFixture.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
test('registered Ammachi run forwards native transport and retains every original geography/scope observation',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected default network')})
 const fixture=nativeFixture(import.meta.url),calls=[],reports=[],jobs=await run({fetchPage:async url=>{calls.push(url);return fixture.fetchPage(url)},onAudit:r=>reports.push(r)})
 assert.equal(calls.filter(u=>u===JOBS_API_URL).length,2);assert.equal(jobs.length,22)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readSourceObservationEvidence(jobs,'ammachilabs').observedVacancyCount,23)
 assert.equal(reports[0].observations.length,23);assert.equal(reports[0].unknownCountryRecords,23)
 assert.equal(jobs[0].nativeLocationEvidence.positionJobLocation,'')
})
test('Ammachi role-owned explicit foreign or India labels retain their country and native scope',()=>{
 const current=structuredClone(records.slice(1,3));current[0].position_job_location='Toronto, Canada';current[1].position_job_location='Remote, India'
 const jobs=extractSearchResults(current)
 assert.equal(jobs[0].country,'Canada');assert.equal(jobs[0].location,'Toronto, Canada')
 assert.equal(jobs[1].country,'India');assert.equal(jobs[1].location,'Remote, India');assert.equal(jobs[1].city,null)
})
test('Ammachi employer contacts, organization address and travel wording do not create role workplace proof',()=>{
 const current=structuredClone(records.slice(1,3));current[0].position_contacts='<p>Office: Amritapuri, Kerala, India</p>';current[0].yoast_head_json={schema:{'@graph':[{'@type':'Organization',address:{addressCountry:'IN',addressLocality:'Amritapuri'}}]}}
 current[1].position_description+='<p>Travel across India as required.</p>'
 const jobs=extractSearchResults(current);assert.ok(jobs.every(j=>j.location===null&&j.country===null))
})
test('contradictory explicit role countries are never collapsed into India',()=>{
 const current=structuredClone(records.slice(1,2));current[0].position_job_location='Toronto, Canada, India'
 assert.throws(()=>extractSearchResults(current))
})
test('actual split WordPress workplace street address is retained without guessing campus city or country',()=>{
 const job=extractSearchResults(records).find(j=>j.jobId==='27488')
 assert.equal(job.location,'Ammachilabs, Amritapuri');assert.equal(job.city,null);assert.equal(job.country,null)
})
test('another valid role uses split native address fields and an explicit typed country',()=>{
 const record=structuredClone(records[1]);record.position_job_location_streetAddress='Native test campus'
 record.position_job_location_addressLocality='Kollam';record.position_job_location_addressCountry='IN'
 const job=extractSearchResults([record])[0]
 assert.ok(job.location.includes('Native test campus'));assert.equal(job.city,'Kollam');assert.equal(job.country,'India')
})
test('split typed country cannot contradict an explicit role workplace country',()=>{
 const record=structuredClone(records[1]);record.position_job_location='Remote, India';record.position_job_location_addressCountry='CA'
 assert.throws(()=>extractSearchResults([record]))
})

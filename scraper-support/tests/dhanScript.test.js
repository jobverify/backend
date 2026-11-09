import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C26/capture.json.gz',import.meta.url))))
const original=url=>{const row=capture.documents[url];assert.ok(row);return {status:row.status,url:row.finalUrl,headers:row.headers,body:row.body}}
import * as source from '../../scraper/dhan/script.js'
import {ROOT_URL,ACTIVE_URL,PORTAL_URL,readCurrentActiveRecords} from '../../scraper/dhan/currentNative.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const records=JSON.parse(original(ACTIVE_URL).body),portalInfo=JSON.parse(original(PORTAL_URL).body)
test('Dhan source factory retains the native group identity without a Dhan legal employer default',async()=>{
 const jobs=await source.createDhanScraper({maxJobs:2}).run({fetchPage:async url=>original(url)})
 assert.equal(jobs.length,2);assert.ok(jobs.every(job=>job.company==='Raise holding'&&job.legalEmployer===null&&job.companyDomain===null&&job.sourceOriginalCompanyName==='Dhan'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Dhan rejects duplicate records and non-array active models',()=>{
 assert.throws(()=>readCurrentActiveRecords(JSON.stringify([records[0],records[0]])),/duplicate/)
 assert.throws(()=>readCurrentActiveRecords('{}'),/array/)
 assert.throws(()=>readCurrentActiveRecords(JSON.stringify([{...records[0],jobLocations:{}}])),/vacancy/)
})
test('Dhan only maps native publication timestamps and the declared client employment codes',()=>{
 const record=records[0],job=source.normalizeKekaJob(record,{portalInfo});assert.equal(job.postingDate,record.publishedOn);assert.equal(job.firstPublishedAt,null);assert.equal(job.employmentType,'Full-time')
 const altered=source.normalizeKekaJob({...record,publishedOn:'2026-02-30T00:00:00Z',jobType:999},{portalInfo});assert.equal(altered.postingDate,null);assert.equal(altered.employmentType,null)
 assert.equal(job.applyUrl,ROOT_URL+'jobdetails/'+record.id);assert.equal(job.applicationVisited,false)
})
test('Dhan withholds a native role whose complete DTO changes at closing',async()=>{
 let reads=0;const id=records[0].id,jobs=await source.run({fetchPage:async url=>{const page=original(url);if(url===ACTIVE_URL&&++reads===2){const latest=JSON.parse(page.body);latest[0].title+=' changed';page.body=JSON.stringify(latest)}return page}})
 assert.equal(jobs.length,29);assert.equal(jobs.some(job=>job.sourceNativeJobId===String(id)),false);assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,false)
})
test('Dhan changed group employer identity at closing cannot certify earlier roles',async()=>{
 let reads=0;await assert.rejects(()=>source.run({fetchPage:async url=>{const page=original(url);if(url===PORTAL_URL&&++reads===2)page.body=page.body.replaceAll('Raise holding','Other employer');return page}}),/employer/)
})
test('Dhan an opening denied native feed is a failure, never an authoritative empty inventory',async()=>{
 await assert.rejects(()=>source.run({fetchPage:async url=>url===ACTIVE_URL?{...original(url),status:403,body:'denied'}:original(url)}),error=>error.status===403)
})
test('Dhan pre-cancellation prevents every original request',async()=>{
 const reason={exact:'caller'},signal=AbortSignal.abort(reason);let calls=0
 await assert.rejects(()=>source.run({signal,fetchPage:async()=>{calls++;return {}}}),error=>error===reason);assert.equal(calls,0)
})

import * as capturedFs from 'node:fs'
import {gunzipSync as capturedGunzip} from 'node:zlib'
import * as nativeSource from './script.js'
import {readInventoryEvidence as capturedInventory} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence as capturedObservations} from '../../scraper-support/utils/sourceObservationEvidence.js'
const nativePacket=JSON.parse(capturedGunzip(capturedFs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const nativePage=url=>{const row=nativePacket.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded native URL '+url);return row.body}
const withCapturedNative=async(callback,alter=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||''),recorded=nativePacket.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unrecorded native request '+url+' '+body);const row=alter({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper-support/tests/fixtures/nitaragormalonellp',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')

const loadNitaraGormaloneModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected NITARA Gormalone LLP scraper module at ./script.js')
  }
}

test('NITARA Gormalone LLP scraper constants stay pinned to the verified first-party homepage and careers page', async () => {
  const nitara = await loadNitaraGormaloneModule()

  assert.equal(nitara.SOURCE, 'nitaragormalonellp')
  assert.equal(nitara.COMPANY, 'NITARA Gormalone LLP')
  assert.equal(nitara.HOMEPAGE_URL, 'https://gormalone.com/')
  assert.equal(nitara.CAREERS_URL, 'https://gormalone.com/careers.html')
  assert.equal(nitara.APPLY_EMAIL, 'hr@gormalone.com')
  assert.equal(nitara.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(nitara.hasOfficialCareersSignal(careersHtml), true)
})

test("NITARA native PDF links retain five title bindings with unknown IDs and geography",async()=>{const jobs=nativeSource.extractPublicListings(nativePage(nativeSource.CAREERS_URL));assert.equal(jobs.length,5);assert.equal(jobs[0].title,'Female Field Associate');assert.ok(jobs.every(job=>job.sourceUrl.startsWith('https://gormalone.com/files/JD/')&&job.country==null&&job.location==null&&job.jobId==null&&job.requisitionId==null&&job.jobDescription==null));assert.equal(jobs[0].applyUrl,'mailto:hr@gormalone.com')})

test("NITARA default native PDF path preserves three listing/document title contradictions",async()=>{await withCapturedNative(async calls=>{const jobs=await nativeSource.run();assert.equal(calls.length,7);assert.equal(jobs.length,5);assert.equal(jobs.filter(job=>job.jobDescription).length,2);assert.equal(jobs.filter(job=>job.rawNativeRoleEvidence.identityQualified===false).length,3);assert.ok(jobs.every(job=>job.country==null&&job.location==null&&job.postingDate==null));assert.equal(capturedInventory(jobs).status,'coverage-gap')})})

test("NITARA missing homepage identity or public role-document scope fails closed",async()=>{await assert.rejects(nativeSource.run({fetchText:async()=>'<html><title>Changed</title></html>'}),/native:/);assert.throws(()=>nativeSource.extractPublicListings('<html><title>Careers at Gormalone</title></html>'),/native:/)})

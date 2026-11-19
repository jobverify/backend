import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readCdotListing,CURRENT_OPENINGS_URL} from './nativeModels.js'
import {run} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const html=gunzipSync(readFileSync(new URL('./test-data/current-mixed-listing-20261119.html.gz',import.meta.url))).toString('utf8')
const historical=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-extension-20261118.json.gz',import.meta.url))))

test('C-DOT retains the new separate-portal internship without suppressing the independently bound advertisement',()=>{
 const page=readCdotListing(html)
 assert.equal(page.rows.length,1)
 assert.equal(page.rows[0].nativeApplicationAdvertisementID,'28')
 assert.equal(page.unqualifiedRows.length,1)
 const held=page.unqualifiedRows[0]
 assert.equal(held.applyUrl,'https://paid-internship.cdot.in/')
 assert.equal(held.nativeApplicationAdvertisementID,null)
 assert.equal(held.jobId,null)
 assert.equal(held.recordKind,'unqualified-recruitment-record')
 assert.match(held.title,/Paid Internship Scheme-2027/)
 assert.ok(held.tree.children.length)
})

test('C-DOT mixed-date original replay fetches only the reviewed advertisement and retains both listing records',async()=>{
 const calls=[]
 const jobs=await run({now:'2026-11-19T03:40:00.000Z',minIntervalMs:0,fetchImpl:async(url,init)=>{
  calls.push(url);assert.equal(init.method,'GET');assert.equal(init.credentials,'omit')
  const packet=historical.find(row=>row.url===url)
  assert.ok(packet,'Only existing publisher-declared reviewed advertisement is read')
  const body=url===CURRENT_OPENINGS_URL?Buffer.from(html):Buffer.from(packet.bodyBase64,'base64')
  const headers={...packet.headers};delete headers['content-length']
  return Object.defineProperty(new Response(body,{status:packet.status,headers}),'url',{value:packet.finalURL})
 }})
 assert.equal(calls.length,4)
 assert.ok(calls.every(url=>url===CURRENT_OPENINGS_URL||url.endsWith('/Notification_JD_YP.pdf')))
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].nativeApplicationAdvertisementID,'28')
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceDetailComplete,true)
 const observations=readSourceObservationEvidence(jobs,'cdot')
 assert.equal(observations.observedRecordCount,2)
 assert.equal(observations.observedVacancyCount,1)
 assert.equal(observations.recordKind,'mixed')
 const audit=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(audit.unqualifiedListingRecords.length,1)
 assert.equal(audit.closingIndex.nativeRecord.unqualifiedRows.length,1)
 assert.equal(audit.nativePositions,null)
 assert.equal(audit.nativePositionsObserved,5)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.cleanupOptions?.replaceExisting??false,false)
})

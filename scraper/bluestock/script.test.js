import * as capturedFs from 'node:fs'
import {gunzipSync as capturedGunzip} from 'node:zlib'
import * as nativeSource from './script.js'
import {readInventoryEvidence as capturedInventory} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence as capturedObservations} from '../../scraper-support/utils/sourceObservationEvidence.js'
const nativePacket=JSON.parse(capturedGunzip(capturedFs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const nativePage=url=>{const row=nativePacket.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded native URL '+url);return row.body}
const withCapturedNative=async(callback,alter=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||''),recorded=nativePacket.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unrecorded native request '+url+' '+body);const row=alter({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ATS_PLATFORM,
  CAREER_PAGE_URL,
  COMPANY_DOMAIN,
  JOBS_PAGE_URL,
  extractHighlightedRoles,
  extractJobCategories,
} from './script.js'

const highlightedCareersHtml = `
  <section>
    <strong>Social Media Internship &amp; Job</strong>
    <a href="https://tally.so/r/mYka9W">Apply Now</a>
  </section>
`

const jobsCategoryHtml = `
  <div class="job-category-card">
    <h5>Software Engineer</h5>
    <p>04 Job Openings</p>
    <a href="https://bluestock.in/careers/jobs/apply/">View All Jobs</a>
  </div>
  <div class="job-category-card">
    <h5>Business Analyst</h5>
    <p>02 Job Openings</p>
    <a href="https://bluestock.in/careers/jobs/apply/">View All Jobs</a>
  </div>
`

test("Bluestock public promoted labels preserve unknown workplace, IDs and full description",async()=>{const jobs=nativeSource.extractHighlightedRoles(nativePage(nativeSource.CAREER_PAGE_URL));assert.deepEqual(jobs.map(job=>job.title),['Social Media Internship & Job','Flutter Developer Intern / Job']);assert.ok(jobs.every(job=>job.jobId==null&&job.requisitionId==null&&job.country==null&&job.location==null&&job.jobDescription==null));assert.equal(jobs[0].applyUrl,'https://tally.so/r/mYka9W')})

test("Bluestock generic categories retain their counts without becoming requisitions",async()=>{const jobs=nativeSource.extractJobCategories(nativePage(nativeSource.JOBS_PAGE_URL)),audit=jobs.nativeCollectionEvidence;assert.equal(jobs.length,0);assert.equal(audit.recordKind,'categories');assert.equal(audit.observedRecordCount,3);assert.equal(audit.observedVacancyCount,0);assert.deepEqual(audit.observedCategories.map(row=>row.publishedOpeningCount),[4,2,3]);assert.equal(capturedInventory(jobs).reportedTotal,null)})

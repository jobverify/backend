import * as capturedFs from 'node:fs'
import {gunzipSync as capturedGunzip} from 'node:zlib'
import * as nativeSource from '../../scraper/bluestock/script.js'
import {readInventoryEvidence as capturedInventory} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence as capturedObservations} from '../../scraper-support/utils/sourceObservationEvidence.js'
const nativePacket=JSON.parse(capturedGunzip(capturedFs.readFileSync(new URL('../../scraper/bluestock/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const nativePage=url=>{const row=nativePacket.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded native URL '+url);return row.body}
const withCapturedNative=async(callback,alter=row=>row)=>{const original=globalThis.fetch,calls=[];globalThis.fetch=async(input,options={})=>{const url=String(input),method=options.method||'GET',body=String(options.body||''),recorded=nativePacket.requests.find(row=>row.url===url&&(row.method||'GET')===method&&(method==='GET'||row.requestBody===body));assert.ok(recorded,'Unrecorded native request '+url+' '+body);const row=alter({...recorded});calls.push({url,method,body});const response=new Response(Buffer.from(row.body,row.bodyEncoding),{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalUrl});return response};try{return await callback(calls)}finally{globalThis.fetch=original}}
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  JOBS_PAGE_URL,
  extractHighlightedRoles,
  extractJobCategories,
} from '../../scraper/bluestock/script.js'

const careersHtml = `
  <html>
    <body>
      <div class="alert">
        <strong>Social Media Internship & Job</strong>
        <a href="https://tally.so/r/mYka9W">
          <button>Apply Now</button>
        </a>
      </div>
    </body>
  </html>
`

const jobsHtml = `
  <html>
    <body>
      <div class="job-category-card">
        <div class="job-category-card-body">
          <h5>Software Engineer</h5>
          <p><i class="fas fa-briefcase"></i> 04 Job Openings</p>
          <a href="https://bluestock.in/careers/jobs/apply/" class="view-all-jobs-btn">View All Jobs</a>
        </div>
      </div>
      <div class="job-category-card">
        <div class="job-category-card-body">
          <h5>Business Analyst</h5>
          <p><i class="fas fa-briefcase"></i> 02 Job Openings</p>
          <a href="https://bluestock.in/careers/jobs/apply/" class="view-all-jobs-btn">View All Jobs</a>
        </div>
      </div>
      <div class="job-category-card">
        <div class="job-category-card-body">
          <h5>UI UX Designer</h5>
          <p><i class="fas fa-briefcase"></i> 03 Job Openings</p>
          <a href="https://bluestock.in/careers/jobs/apply/" class="view-all-jobs-btn">View All Jobs</a>
        </div>
      </div>
    </body>
  </html>
`

test('career page constants keep the Bluestock scraper on the official careers pages', () => {
  assert.equal(CAREER_PAGE_URL, 'https://bluestock.in/careers/')
  assert.equal(JOBS_PAGE_URL, 'https://bluestock.in/careers/jobs/')
})

test("promoted Bluestock role labels retain native routes without fabricated descriptions or identifiers",async()=>{const jobs=nativeSource.extractHighlightedRoles(nativePage(nativeSource.CAREER_PAGE_URL));assert.deepEqual(jobs.map(job=>job.title),['Social Media Internship & Job','Flutter Developer Intern / Job']);assert.ok(jobs.every(job=>job.jobId==null&&job.requisitionId==null&&job.country==null&&job.location==null&&job.jobDescription==null));assert.equal(jobs[0].applyUrl,'https://tally.so/r/mYka9W')})

test("Bluestock category counts remain discovery observations rather than job records",async()=>{const jobs=nativeSource.extractJobCategories(nativePage(nativeSource.JOBS_PAGE_URL)),audit=jobs.nativeCollectionEvidence;assert.equal(jobs.length,0);assert.equal(audit.recordKind,'categories');assert.equal(audit.observedRecordCount,3);assert.equal(audit.observedVacancyCount,0);assert.deepEqual(audit.observedCategories.map(row=>row.publishedOpeningCount),[4,2,3]);assert.equal(capturedInventory(jobs).reportedTotal,null)})

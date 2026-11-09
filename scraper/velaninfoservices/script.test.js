import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

import {
  COMPANY,
  JOBS_URL,
  OVERVIEW_URL,
  SOURCE,
  createVelanInfoServicesScraper,
  extractJobs,
  hasOfficialCareersSignal,
  hasOfficialJobsSignal,
} from './script.js'

const careersHtml = `
  <html>
    <head><title>Velan | Jobs | Career Opportunities | IT &amp; BPO Jobs</title></head>
    <body>
      <h1>Career Opportunities</h1>
      <a class="joinus" href="https://www.velaninfo.com/jobs">Current Openings</a>
      <h2>Build Your Dream Career with Velan</h2>
    </body>
  </html>
`

const jobsHtml = `
  <html>
    <head><title>Velan | Current Openings | IT &amp; BPO Job Opportunites at Velan</title></head>
    <body>
      <h1>Join Our Team</h1>
      <h2>Current Openings</h2>
      <p>If you would like to work with us, send your resume to careers@velaninfo.com</p>
      <div class="job-opening-list">
        <h3>Senior Accountant (JOB ID: 072026-62029) - <span>3 <span>Positions</span></span></h3>
        <ul>
          <li>Yardi/Buildium/AppFolio, US Accounting</li>
          <li>|</li>
          <li><b>Experience:</b> 7+ Years</li>
          <li>|</li>
          <li><b>Location:</b> Coimbatore</li>
        </ul>
        <p class="cpst">Posted on: 16-07-2026</p>
        <a href="https://www.velaninfo.com/jobs/senior-accountant-072026-62029"><button>Apply Now</button></a>
      </div>
      <div class="job-opening-list">
        <h3>Process Executive (JOB ID: 072026-62030) - <span>4 <span>Positions</span></span></h3>
        <ul>
          <li>Data processing and quality checks</li>
          <li>|</li>
          <li><b>Experience:</b> 1+ Years</li>
          <li>|</li>
          <li><b>Location:</b> Coimbatore</li>
        </ul>
        <p class="cpst">Posted on: 16-07-2026</p>
        <a href="https://www.velaninfo.com/jobs/process-executive-072026-62030"><button>Apply Now</button></a>
      </div>
    </body>
  </html>
`

// These short historical samples intentionally lack current native grouping,
// contact authority and full role documents. They remain rejected evidence.
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/velan-native-quality.json.gz',import.meta.url))))
const contact='https://www.velaninfo.com/contact',sha=b=>createHash('sha256').update(b).digest('hex')
const lookup=url=>fixture.packets.find(p=>p.requestedURL===url)
const roles=fixture.packets.filter(p=>p.requestedURL.includes('/jobs/')).map(p=>p.requestedURL)
async function replay(t,change=()=>{}){
 const calls=[],fetchImpl=async(input,init={})=>{
  const url=String(input),p=lookup(url);assert.ok(p,'Only current genuine native entities: '+url)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined)
  const bytes=Buffer.from(p.bodyText);assert.equal(bytes.length,p.bodyBytes);assert.equal(sha(bytes),p.bodySHA256)
  const q=structuredClone(p);change(q);calls.push(url)
  const response=new Response(q.bodyText,{status:q.status,headers:q.headers});Object.defineProperty(response,'url',{value:q.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 return{calls,run:()=>createVelanInfoServicesScraper({fetchImpl,minIntervalMs:0,now:()=> '2026-11-05T18:00:00.000Z'}).run()}
}
test('Velan keeps the reviewed canonical careers URL and rejects incomplete historical previews',()=>{
 assert.equal(SOURCE,'velaninfoservices');assert.equal(COMPANY,'Velan Info Services')
 assert.equal(OVERVIEW_URL,'https://www.velaninfo.com/careers');assert.equal(JOBS_URL,'https://www.velaninfo.com/jobs')
 assert.equal(fixture.historicalDeclaredCanonicalRedirect.requestedURL,OVERVIEW_URL+'/')
 assert.equal(fixture.historicalDeclaredCanonicalRedirect.status,301)
 assert.equal(fixture.historicalDeclaredCanonicalRedirect.headers.location,OVERVIEW_URL)
 assert.equal(hasOfficialCareersSignal(careersHtml),false)
 assert.equal(hasOfficialJobsSignal(jobsHtml),false)
 assert.throws(()=>extractJobs(jobsHtml),/missing, unassigned or oversized native role set/)
})
test('genuine current listing preserves twelve native identities without promoting previews to full India roles',()=>{
 assert.equal(fixture.packets.length,15)
 for(const p of fixture.packets){assert.equal(p.replayed,false);assert.equal(sha(Buffer.from(p.bodyText)),p.bodySHA256);assert.equal(Buffer.byteLength(p.bodyText),p.bodyBytes)}
 assert.equal(hasOfficialCareersSignal(lookup(OVERVIEW_URL).bodyText),true)
 assert.equal(hasOfficialJobsSignal(lookup(JOBS_URL).bodyText),true)
 const rows=extractJobs(lookup(JOBS_URL).bodyText);assert.equal(rows.length,12)
 for(const row of rows){assert.equal(row.country,null);assert.equal(row.location,null);assert.equal(row.city,null);assert.equal(row.requisitionId,null)
  assert.equal(row.employmentType,null);assert.equal(row.jobDescription,null);assert.equal(row.sourceDetailComplete,false)
  assert.equal(row.nativeLocation,'Coimbatore');assert.ok(roles.includes(row.sourceUrl));assert.equal(row.applyUrl,row.sourceUrl)}
})
test('Velan runner reconciles publisher, board, contact and all twelve full role documents in thirty exact reads',async t=>{
 const r=await replay(t),jobs=await r.run(),sequence=[OVERVIEW_URL,JOBS_URL,contact,...roles]
 assert.deepEqual(r.calls,[...sequence,...sequence]);assert.equal(jobs.length,12)
 for(const job of jobs){assert.equal(job.source,SOURCE);assert.equal(job.country,'India');assert.equal(job.location,'Coimbatore')
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeRoleClosingReconciled,true);assert.ok(job.sourceDescription.length>700)
  assert.equal(job.sourceDescription,job.jobDescription);assert.equal(job.sourceRawNativeHTML,lookup(job.sourceUrl).bodyText)
  assert.equal(job.sourceClosingRawNativeHTMLSHA256,lookup(job.sourceUrl).bodySHA256)
  assert.equal(job.link,job.sourceUrl);assert.equal(job.scrapedAt,'2026-11-05T18:00:00.000Z')
  assert.equal(job.requisitionId,null);assert.equal(job.employmentType,null);assert.equal(job.applicationFormSubmitted,false)
  assert.equal(job.activeApplyVerified,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)}
 const accountant=jobs.find(j=>j.jobId==='102026-62053');assert.equal(accountant.postingDate,'2026-10-15')
 assert.match(accountant.sourceDescription,/Roles and Responsibilities:/);assert.match(accountant.sourceDescription,/Candidate Profile:/)
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
})
test('historical body-only injection cannot bypass current HTTP response provenance',async()=>{
 let reads=0
 await assert.rejects(()=>createVelanInfoServicesScraper().run({fetchText:async()=>{reads++;return careersHtml}}),/HTTP response metadata required/)
 assert.equal(reads,0)
})
test('current publisher denial stops before the native listing without certifying zero vacancies',async t=>{
 const r=await replay(t,p=>{p.status=403;p.bodyText='Forbidden'})
 await assert.rejects(r.run,e=>e.status===403&&e.inventoryEvidence.reportedTotal===null&&e.inventoryEvidence.status==='coverage-gap')
 assert.equal(r.calls.length,1)
})

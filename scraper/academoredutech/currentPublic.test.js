import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run as academor,extractJobPostings} from './script.js'
import {run as amazecodes} from '../amazecodes/script.js'
import {run as codeemy,pageIndicatesAnaptyCodeemyCompany} from '../anaptycodeemy/script.js'
import {run as campus} from '../campussutra/script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=source=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/current-public-20261103.json.gz',import.meta.url))))
const examples=[['academoredutech',academor,0],['amazecodes',amazecodes,4],['anaptycodeemy',codeemy,10],['campussutra',campus,9]]
for(const[source,run,announcements]of examples)test(source+' preserves exact current native employer/posts and unwanted keyword scope without successful employer zero',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Object.assign(Error('Offline HTTP tripwire'),{abortRetries:true})})
 const f=fixture(source),calls=[];let audit
 const jobs=await run({fetchPage:async(url,options)=>{calls.push(url);const row=f.responses.find(row=>row.url===url);assert.ok(row,'Only current configured source URLs');return{url:row.finalURL,status:row.status,html:row.body,headers:row.headers}},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(audit.nativeAnnouncements.length,announcements);assert.equal(audit.nativeOrganizationId,{academoredutech:'82553226',amazecodes:'9482063',anaptycodeemy:'108095496',campussutra:'3032227'}[source]);assert.equal(audit.closingReconciled,true);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyGlobalTotal,null)
 assert.equal(calls.length,source==='academoredutech'?2:4)
 if(source!=='academoredutech'){assert.deepEqual(audit.configuredSearch.keywordValues,['Jobs']);assert.equal(audit.configuredSearch.unexpectedKeywordRestriction,true);assert.equal(audit.configuredSearch.observedJobCardCount,0)}
 for(const row of audit.nativeAnnouncements){assert.equal(row.jobId,null);assert.equal(row.requisitionId,null);assert.equal(row.jobPostingDate,null);assert.equal(row.country,null);assert.ok(row.originalText);assert.ok(row.announcementPublishedAt)}
})

test('Amazecodes retains every job-owned public announcement criterion without turning Remote or company office India into work-country proof',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Object.assign(Error('Offline HTTP tripwire'),{abortRetries:true})})
 const f=fixture('amazecodes');let audit
 await amazecodes({fetchPage:async url=>{const row=f.responses.find(r=>r.url===url);return{url,status:200,html:row.body}},onAudit:value=>{audit=value}})
 const role=audit.nativeAnnouncements.find(row=>row.hiringSignal)
 for(const value of ['SXA, JSS, Content Serialization, XM Cloud','SAP, Microsoft Dynamics, Oracle EBS, or NetSuite','high-volume data processing','4+ Years','6-month contract position (extendable)','Location: Remote'])assert.ok(role.originalText.includes(value))
 assert.equal(role.country,null);assert.equal(role.jobPostingDate,null);assert.equal(role.jobDescription,null);assert.equal(role.fullNativeJobDescriptionQualified,false)
})

test('Academor historical article reader never appends an invented India country or default On-site work mode',()=>{
 const rows=extractJobPostings('<article><a href="https://www.linkedin.com/posts/academor_hiring-activity-123-x">Academor hiring</a><p>Position: Engineer Location: Stockholm Industry: Software</p></article>')
 assert.equal(rows.length,1);assert.equal(rows[0].location,'Stockholm');assert.equal(rows[0].country,null);assert.equal(rows[0].remoteStatus,null)
})

test('Academor article observations retain later native requirements and explicit work-mode wording',()=>{
 const rows=extractJobPostings('<article><a href="https://www.linkedin.com/posts/academor_hiring-activity-123-x">Academor hiring</a><p>Position: Engineer Location: Mumbai Industry: Software Requirements: C++ and distributed systems. Work From Office: Published office location.</p></article>')
 assert.ok(rows[0].jobDescription.includes('Requirements: C++ and distributed systems.'));assert.equal(rows[0].remoteStatus,'On-site');assert.equal(rows[0].country,null)
})

test('CodeEmy current Unicode employer name binds its original native company ID',()=>{
 const html=fixture('anaptycodeemy').responses[0].body
 assert.equal(pageIndicatesAnaptyCodeemyCompany(html),true);assert.equal(pageIndicatesAnaptyCodeemyCompany(html.replaceAll('108095496','9482063')),false)
})

import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyIndigoBinding,readIndigoJobs} from './nativeContract.js'
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261021.json',import.meta.url))),now='2026-10-21T01:00:00Z'
const binding=()=>verifyIndigoBinding(f.corporate,f.board,f.remoteEntry,f.app)
const jobs=payload=>readIndigoJobs(payload??structuredClone(f.payload),{now,config:binding()})
test('current active corporate/public client proves all-response local pagination and exact public apply link',()=>{const all=jobs();assert.equal(all.length,3);const j=all.find(j=>j.jobId==='10351');assert.match(j.applyUrl,/career_job_req_id=10351&jobPipeline=Direct&isInternalUser=false&showAlertCreated=false$/);assert.equal(j.nativeEmployer,'InterGlobe Aviation limited');assert.equal(j.sourceDetailComplete,true);assert.equal(j.city,'Kolkata');assert.equal(j.closingDate,'2026-10-22T18:29:59.000Z');assert.equal(j.sourceClosingDateIsExact,true)})
test('two actual equivalent locales agree on full JD; national scope retains no invented city',()=>{const all=jobs();assert.equal(all.find(j=>j.jobId==='10351').nativeLocaleCount,2);assert.equal(all.find(j=>j.jobId==='7975').city,null);assert.equal(all.find(j=>j.jobId==='7975').location,'Pan-India')})
test('actual Job Description Sample is missing native content, never company boilerplate',()=>{const j=jobs().find(j=>j.jobId==='6871');assert.equal(j.sourceDetailComplete,false);assert.equal(j.jobDescription,null)})
for(const [label,change]of [
 ['wrong company',j=>j.legalEntity_obj.name='Other Employer'],
 ['coerced ID',j=>j.jobReqId=[j.jobReqId]],
 ['missing public posting',j=>j.jobReqPostings.results=j.jobReqPostings.results.filter(p=>p.boardId!=='_external')],
 ['wrong public posting ID',j=>j.jobReqPostings.results.find(p=>p.boardId==='_external').jobReqId='9999'],
 ['non-public fallback',j=>j.jobReqPostings.results=j.jobReqPostings.results.map(p=>({...p,boardId:'_private_external'}))],
 ['public posting failure',j=>j.jobReqPostings.results.find(p=>p.boardId==='_external').postingStatus='Deleted'],
 ['future publication',j=>j.jobReqPostings.results.find(p=>p.boardId==='_external').postStartDate='/Date(4070908800000)/'],
 ['malformed date',j=>j.jobReqPostings.results.find(p=>p.boardId==='_external').postStartDate=['/Date(1792055645000)/']],
 ['unknown city',j=>j.location_obj.results[0].name='Remote'],
 ['office code mismatch',j=>j.location_obj.results[0].externalCode='US'],
 ['explicit country conflict',j=>j.location_obj.results[0].country='United States'],
 ['inactive status',j=>j.status.results[0].status='INACTIVE'],
])test('native row rejects '+label,()=>{const p=structuredClone(f.payload);change(p.result[0]);assert.throws(()=>jobs(p))})
test('duplicate IDs and conflicting returned locales fail',()=>{const p=structuredClone(f.payload);p.result.push(p.result[0]);assert.throws(()=>jobs(p));const q=structuredClone(f.payload),row=q.result.find(j=>j.jobReqId==='10351');row.jobReqLocale.results[1].externalTitle='Another Job';assert.throws(()=>jobs(q))})
for(const extra of [{Status:500},{success:false},{error:'failure'},{status:'200'},{total:99}])test('malformed or failure HTTP200 payload fails '+JSON.stringify(extra),()=>assert.throws(()=>jobs({...structuredClone(f.payload),...extra})))
test('hidden or inert full JD stays missing',()=>{for(const html of ['<div hidden>Build production software systems with our engineering team.</div>','<template><p>Build production software systems.</p></template>','<div hidden><template></div></template><p>Build hidden production systems.</p></div>']){const p=structuredClone(f.payload),row=p.result.find(j=>j.jobReqId==='6871');row.jobReqLocale.results[0].externalJobDescription=html;assert.equal(jobs(p).find(j=>j.jobId==='6871').sourceDetailComplete,false)}})
test('inert configuration, nomodule loader, changed client or wrong apply tenant never prove inventory',()=>{assert.throws(()=>verifyIndigoBinding(f.corporate,f.board.replace('<script>','<template><script>'),f.remoteEntry,f.app));assert.throws(()=>verifyIndigoBinding(f.corporate,f.board.replace('<script src=','<script nomodule src='),f.remoteEntry,f.app));assert.throws(()=>verifyIndigoBinding(f.corporate,f.board,f.remoteEntry,f.app+'\nchanged'));assert.throws(()=>verifyIndigoBinding(f.corporate,f.board.replace('company=interglobe','company=other'),f.remoteEntry,f.app))})

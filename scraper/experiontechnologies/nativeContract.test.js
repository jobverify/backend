import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyExperionInventory,validateExperionDetail} from './nativeContract.js'
import {extractActiveDescription} from './nativeHtml.js'
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261021.json',import.meta.url))),now='2026-10-21T00:20:00Z'
const rows=()=>verifyExperionInventory(f.homepage,f.listing,f.client)
test('template end tags cannot escape hidden full-description context',()=>assert.equal(extractActiveDescription('<div hidden><template></div></template><p>Build hidden systems and maintain production software with engineering teams.</p></div>'),null))
test('actual native heading en dash and Yoast ASCII dash preserve the same role identity',()=>{const row=rows().find(j=>j.jobId==='lead-ai-engineer-gen-ai');assert.equal(validateExperionDetail(f.dashDetail,row,{now}).title,'Lead AI Engineer – Gen AI')})
test('current official native client reveals all29 rendered rows with explicit India offices, retaining remote scope unknown',()=>{const jobs=rows();assert.equal(jobs.length,29);assert.equal(jobs.filter(j=>j.nativeRemoteScopeUnknown).length,4);assert.ok(jobs.every(j=>j.country==='India'))})
test('native full role content, role-local apply form and exact page publication date are retained',()=>{const job=validateExperionDetail(f.detail,rows()[0],{now});assert.equal(job.title,'Test Lead');assert.equal(job.sourceDetailComplete,true);assert.equal(job.jobDescription.length,1827);assert.ok(job.jobDescription.endsWith('To Adhere to ISMS policies and procedures'));assert.equal(job.postedAt,'2026-10-15T09:37:41.000Z')})
for(const [name,change]of [
 ['wrong country',s=>s.replaceAll('Hybrid, Kochi, Trivandrum','New York, United States')],
 ['unknown remote',s=>s.replaceAll('Hybrid, Kochi, Trivandrum','Remote')],
 ['missing city',s=>s.replaceAll('Hybrid, Kochi, Trivandrum','Unspecified')],
 ['contradictory city',s=>s.replaceAll('Hybrid, Kochi, Trivandrum','Kochi, United States')],
 ['wrong tenant',s=>s.replaceAll('https://experionglobal.com/jobs/test-lead/','https://other.example/jobs/test-lead/')],
 ['duplicate role',s=>s.replaceAll('https://experionglobal.com/jobs/edifecs-qa-analyst/','https://experionglobal.com/jobs/test-lead/')],
])test('native listing rejects '+name,()=>assert.throws(()=>verifyExperionInventory(f.homepage,change(f.listing),f.client)))
test('unreviewed client pagination contract cannot certify full enumeration',()=>assert.throws(()=>verifyExperionInventory(f.homepage,f.listing,f.client+'\nfetch("/next")')))
test('inert script MIME type cannot establish native schema or executable pagination',()=>{assert.throws(()=>validateExperionDetail(f.detail.replaceAll('type="application/ld+json"','type="text/plain"'),rows()[0],{now}));assert.throws(()=>verifyExperionInventory(f.homepage,f.listing.replace(/<script([^>]*src=["']https:\/\/experionglobal.com\/wp-content\/themes\/experionglobal\/assets\/js\/main.js["'][^>]*)>/,'<script type="text/plain"$1>'),f.client))})
for(const [name,change]of [
 ['title disagreement',s=>s.replace('<h1 class="job-title">Test Lead','<h1 class="job-title">Other Role')],
 ['country disagreement',s=>s.replace('Hybrid, Kochi, Trivandrum','Hybrid, London, United Kingdom')],
 ['foreign apply target',s=>s.replace('action="/jobs/test-lead/#','action="https://other.example/jobs/test-lead/#')],
 ['future native publication',s=>s.replace('2026-10-15T09:37:41+00:00','2099-10-15T09:37:41+00:00')],
 ['impossible native publication',s=>s.replace('2026-10-15T09:37:41+00:00','2026-02-30T09:37:41+00:00')],
 ['schema native URL conflict',s=>s.replaceAll('https:\\/\\/experionglobal.com\\/jobs\\/test-lead\\/','https:\\/\\/other.example\\/jobs\\/test-lead\\/')],
])test('native detail rejects '+name,()=>assert.throws(()=>validateExperionDetail(change(f.detail),rows()[0],{now})))
test('hidden or absent native JD cannot use surrounding metadata or application form',()=>{for(const attr of ['hidden','style="display:none"']){const job=validateExperionDetail(f.detail.replace('class="job-description"',`class="job-description" ${attr}`),rows()[0],{now});assert.equal(job.sourceDetailComplete,false);assert.equal(job.jobDescription,null)}})

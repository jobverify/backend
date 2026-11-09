import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyAeriesBinding,readAeriesRows,validateAeriesDetail,nativeRoleUrl} from './nativeContract.js'
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261021.json',import.meta.url))),now='2026-10-21T01:00:00Z'
const payload=()=>({d:JSON.stringify({Jobs:structuredClone(f.rows),JobSuggestion:[]})})
test('current active corporate handoff and exact advertised client/template prove native board and local pagination',()=>assert.equal(verifyAeriesBinding(f.corporate,f.board,f.controller,f.main,f.template).board,'https://aeriestechnology.talentrecruit.com/Search/'))
test('actual secondary generic Job Portal title cannot be replaced by another company',()=>assert.throws(()=>verifyAeriesBinding(f.corporate,f.board.replace('<title>Job Portal </title>','<title>Other Company</title>'),f.controller,f.main,f.template)))
test('full native role field replaces28char skills teaser while preserving canonical numeric ID and dates',()=>{const row=readAeriesRows(payload(),{now})[0],job=validateAeriesDetail(f.details[3476].html,row,{now});assert.equal(job.jobDescription.length,3925);assert.equal(job.jobId,'3476');assert.equal(job.title,'Network Security Engineer');assert.equal(job.nativeClient,'TPX Communications');assert.equal(job.postedAt,'2026-09-30T00:00:00.000Z');assert.equal(job.closingDate,'2026-12-29T00:00:00.000Z');assert.equal(nativeRoleUrl(row),f.details[3476].url)})
test('explicit native Maharashtra state with no city remains India but does not invent a city',()=>{const row=readAeriesRows(payload(),{now}).find(j=>j.REF_REQ_ID===3459),job=validateAeriesDetail(f.details[3459].html,row,{now});assert.equal(job.country,'India');assert.equal(job.city,null);assert.equal(job.location,'Maharashtra, India')})
test('actual native test-description placeholder remains missing despite company boilerplate',()=>{const row=readAeriesRows(payload(),{now}).find(j=>j.REF_REQ_ID===3332),job=validateAeriesDetail(f.details[3332].html,row,{now});assert.equal(job.sourceDetailComplete,false);assert.equal(job.jobDescription,null)})
for(const [label,mutate]of [
 ['wrong country',j=>j.FULL_JOB_LOCATION='New York, United States'],
 ['city conflict',j=>j.JOB_LOCATION='Paris'],
 ['unknown remote',j=>{j.IS_REMOTE=true;j.FULL_JOB_LOCATION='Remote';j.JOB_LOCATION=null}],
 ['coerced numeric ID',j=>j.REF_REQ_ID=[3476]],
 ['malformed remote flag',j=>j.IS_REMOTE='false'],
 ['future posting',j=>{j.POSTED_DATE=j.PostedDateTime='30/Sep/2099'}],
 ['invalid calendar',j=>{j.POSTED_DATE=j.PostedDateTime='30/Feb/2026'}],
 ['date alias conflict',j=>j.CandidateJobOpenTillDateInTick='01/Jan/2099'],
])test('native listing rejects '+label,()=>{const rows=structuredClone(f.rows);mutate(rows[0]);assert.throws(()=>readAeriesRows({d:JSON.stringify({Jobs:rows,JobSuggestion:[]})},{now}))})
for(const [label,extra]of [['uppercase error',{Error:'failure'}],['uppercase status',{Status:500}],['coerced status',{Status:'200'}],['success false',{Success:false}]])test('HTTP200 native envelope rejects '+label,()=>assert.throws(()=>readAeriesRows({...payload(),...extra},{now})))
test('duplicate current native IDs reject',()=>{const p=payload(),d=JSON.parse(p.d);d.Jobs.push(d.Jobs[0]);p.d=JSON.stringify(d);assert.throws(()=>readAeriesRows(p,{now}))})
test('native hot-link count cannot contradict an empty or smaller all-Jobs inventory',()=>{for(const NoOfJobs of [18,'1',[1]])assert.throws(()=>readAeriesRows({d:JSON.stringify({Jobs:[],JobSuggestion:[{JobTitle:'IND_IT_SOFTWARE_SERVICES_TESTING',JobDisplay:'IT-Software / Software Services / testing',NoOfJobs}]})},{now}))})
for(const [label,change]of [
 ['wrong title',s=>s.replace('>Network Security Engineer</span>','>Other Role</span>')],
 ['wrong client ID',s=>s.replace('id="MainContent_hdnClientId" value="20"','id="MainContent_hdnClientId" value="999"')],
 ['wrong native application ID',s=>s.replace('3476-Network-Security+Engineer','9999-Network-Security+Engineer')],
 ['wrong country office',s=>s.replace('>Bangalore</span>','>New York</span>')],
 ['closed role',s=>s.replace('>Open</span>','>Closed</span>')],
 ['wrong company brand',s=>s.replaceAll('Aeries Technology','Other Company')],
])test('native detail rejects '+label,()=>assert.throws(()=>validateAeriesDetail(change(f.details[3476].html),readAeriesRows(payload(),{now})[0],{now})))
test('hidden full JD cannot use AboutUs or teaser fallback',()=>{const html=f.details[3476].html.replace('id="MainContent_divRolesAndResponsibility"','id="MainContent_divRolesAndResponsibility" hidden');assert.equal(validateAeriesDetail(html,readAeriesRows(payload(),{now})[0],{now}).sourceDetailComplete,false)})
test('changed client pagination bytes do not silently keep complete inventory',()=>assert.throws(()=>verifyAeriesBinding(f.corporate,f.board,f.controller+'\nfetch("/next")',f.main,f.template)))

for(const name of ['app.controller-search-job.js','main.js'])test('nomodule advertisement cannot prove active native '+name,()=>{const board=f.board.replace(new RegExp('<script(?=[^>]*'+name.replaceAll('.','\\.')+')'),'<script nomodule');assert.notEqual(board,f.board);assert.throws(()=>verifyAeriesBinding(f.corporate,board,f.controller,f.main,f.template))})
for(const [label,change]of [
 ['wrong requirement',s=>s.replace('id="MainContent_hdnRequirement" value="3476"','id="MainContent_hdnRequirement" value="9999"')],
 ['wrong requirement name',s=>s.replace('name="ctl00$MainContent$hdnRequirement"','name="anotherRequirement"')],
 ['missing requirement',s=>s.replace(/<input\b[^>]*id="MainContent_hdnRequirement"[^>]*>/,'')],
 ['duplicate requirement',s=>s.replace('</form>','<input type="hidden" name="ctl00$MainContent$hdnRequirement" id="duplicateRequirement" value="9999"></form>')],
])test('native application rejects '+label,()=>{const html=change(f.details[3476].html);assert.notEqual(html,f.details[3476].html);assert.throws(()=>validateAeriesDetail(html,readAeriesRows(payload(),{now})[0],{now}))})

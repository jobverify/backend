import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createSigmaComputingScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {SIGMA_OFFICES_URL} from './worksiteCountry.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-details-20261103.json.gz',import.meta.url))))
const officeCapture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/worksite-country-20261103.json.gz',import.meta.url))))
const base='https://boards-api.greenhouse.io/v1/boards/sigmacomputing/jobs'
async function exercise({change=()=>{},beforeRead=()=>{},maxJobs}={}){
 const f={...structuredClone(capture),officePayload:structuredClone(officeCapture.officePayload)},calls=[];change(f);let audit
 const jobs=await createSigmaComputingScraper().run({maxJobs,fetchText:async()=>f.careersHtml,fetchJson:async url=>{
  calls.push(url);beforeRead(f,url,calls);if(url===base+'?content=true')return structuredClone(f.originalNativePayload)
  if(url===SIGMA_OFFICES_URL)return structuredClone(f.officePayload)
  assert.ok(f.responses[url],'Unexpected Sigma native endpoint '+url)
  return JSON.parse(f.responses[url].body)
 },onAudit:a=>{audit=a}})
 return {jobs,audit,calls,fixture:f}
}
const indiaMutationAt=(f,index)=>{
 const board=f.originalNativePayload.jobs[index],packet=f.responses[base+'/'+board.id+'?questions=true'],detail=JSON.parse(packet.body)
 for(const row of [board,detail]){row.location={name:'Bengaluru, Karnataka, India'};row.offices=[{id:9100001+index,name:'Bengaluru',location:'Bengaluru, Karnataka, India',parent_id:null,child_ids:[]}]}
 packet.body=JSON.stringify(detail)
}
const indiaMutation=f=>indiaMutationAt(f,0)
test('Sigma hydrates all76 exact native public application records while retaining original board fields and closing criteria',async()=>{
 const{audit,calls}=await exercise()
 assert.equal(audit.originalNativePayload.jobs.length,76)
 assert.equal(audit.nativeDetailRecords.length,76)
 assert.equal(audit.closingNativeDetailRecords.length,76)
 assert.equal(audit.nativeDetailsStable,true)
 assert.equal(calls.filter(u=>u.endsWith('?questions=true')).length,152)
 assert.equal(calls.filter(u=>u===base+'?content=true').length,3)
 assert.ok(audit.nativeDetailRecords.every(r=>r.record.company_name==='Sigma Computing'&&r.record.id===r.originalBoardRecord.id))
 assert.ok(audit.nativeDetailRecords.some(r=>r.record.offices.some(o=>/United States/.test(o.location))))
 assert.ok(audit.nativeDetailRecords.some(r=>r.jobOwnedQuestions.some(q=>/visa|sponsorship/i.test(q.label))))
 assert.ok(audit.nativeDetailRecords.every(r=>r.jobOwnedQuestions.every(q=>!['First Name','Last Name','Email','Phone','LinkedIn Profile','Website'].includes(q.label))))
 assert.equal(audit.nativeBoardCountryIssues.length,41)
 assert.equal(audit.nativeDetailCountryIssues.length,41)
 assert.equal(audit.projectedNativeDetailCountryIssues.length,33)
 assert.equal(audit.worksiteCountryProofs.length,9)
 assert.equal(audit.worksiteCountryProofsStable,true)
 assert.equal(calls.filter(u=>u===SIGMA_OFFICES_URL).length,2)
 assert.ok(audit.nativeDetailRecords.every(r=>Array.isArray(r.record.location_questions)&&!Object.hasOwn(r.countryRecord,'location_questions')))
 assert.equal(audit.sourceScopeComplete,false)
})

test('Sigma retains country gaps when the exact closing worksite binding changes',async()=>{
 const {audit}=await exercise({beforeRead:(f,url,calls)=>{if(url===SIGMA_OFFICES_URL&&calls.filter(c=>c===url).length===2)f.officePayload.offices.find(o=>o.id===4003396003).location='San Francisco, California, India'}})
 assert.equal(audit.worksiteCountryProofsStable,false)
 assert.ok(audit.changedWorksiteCountryRoleIds.includes('8012144003'))
 assert.equal(audit.authoritativeSourceTotal,null)
})

test('Sigma awaits rejected or abort-ignoring observers and bounds an ignoring corporate reader',async()=>{
 const rejected=Error('Sigma observer failed'),fetchJson=async url=>url===SIGMA_OFFICES_URL?structuredClone(officeCapture.officePayload):url===base+'?content=true'?structuredClone(capture.originalNativePayload):JSON.parse(capture.responses[url].body)
 await assert.rejects(createSigmaComputingScraper().run({fetchText:async()=>capture.careersHtml,fetchJson,onAudit:async()=>{throw rejected}}),e=>e===rejected)
 const c=new AbortController(),reason={stop:'Sigma reader'},timer=setTimeout(()=>c.abort(reason),10)
 try{await assert.rejects(createSigmaComputingScraper().run({signal:c.signal,fetchText:()=>new Promise(()=>{}),fetchJson}),e=>e===reason)}finally{clearTimeout(timer)}
 const observerController=new AbortController(),observerReason={stop:'Sigma observer'};let observerTimer
 try{await assert.rejects(createSigmaComputingScraper().run({signal:observerController.signal,fetchText:async()=>capture.careersHtml,fetchJson,onAudit:()=>{observerTimer=setTimeout(()=>observerController.abort(observerReason),10);return new Promise(()=>{})}}),e=>e===observerReason)}finally{clearTimeout(observerTimer)}
})
test('Sigma preserves selected native India role questions as questions without inferring required answers or country from visa text',async()=>{
 const{jobs}=await exercise({change:indiaMutation,maxJobs:1})
 assert.equal(jobs.length,1)
 const job=jobs[0]
 assert.equal(job.country,'India')
 assert.equal(job.sourceNativeDetailRecord.location.name,'Bengaluru, Karnataka, India')
 assert.ok(job.sourceNativeApplicationQuestions.some(q=>/visa|sponsorship/i.test(q.label)))
 assert.ok(job.sourceNativeDetailRecord.questions.some(q=>q.label==='First Name'))
 assert.equal(job.minimumQualification,null)
 assert.equal(job.sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('Sigma rejects foreign native detail employer or conflicting own identity before any role can be emitted',async()=>{
 for(const field of ['id','company_name'])await assert.rejects(exercise({change:f=>{
  const row=f.originalNativePayload.jobs[0],packet=f.responses[base+'/'+row.id+'?questions=true'],record=JSON.parse(packet.body);record[field]=field==='id'?999:'Other employer';packet.body=JSON.stringify(record)
 }}),/Sigma native detail.*identity/)
})
test('Sigma retains an unknown native mandatory field in evidence and quarantines the affected India role',async()=>{
 const{jobs,audit}=await exercise({change:f=>{
  indiaMutation(f);const row=f.originalNativePayload.jobs[0],packet=f.responses[base+'/'+row.id+'?questions=true'],record=JSON.parse(packet.body);record.requiredProfessionalLicense={required:true};packet.body=JSON.stringify(record)
 }})
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeDetailRecords[0].record.requiredProfessionalLicense.required,true)
 assert.ok(audit.nativeDetailRecords[0].issues.some(issue=>issue.includes('requiredProfessionalLicense')))
 assert.equal(audit.observedNativeBoardCount,76)
})

test('Sigma quarantines a role whose closing native application requirements change while retaining original counts',async()=>{
 const{jobs,audit}=await exercise({change:indiaMutation,beforeRead:(f,url,calls)=>{
  if(!url.endsWith('?questions=true')||calls.filter(c=>c===url).length!==2)return
  const first=f.originalNativePayload.jobs[0];if(!url.includes('/'+first.id+'?'))return
  const record=JSON.parse(f.responses[url].body);record.questions.find(q=>/sponsorship/.test(q.label)).label='Do you meet the newly published professional requirement?';f.responses[url].body=JSON.stringify(record)
 }})
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeDetailsStable,false)
 assert.equal(audit.originalNativePayload.jobs.length,76)
})

test('Sigma preserves cancellation during bounded native application reads',async()=>{
 const controller=new AbortController(),reason=Error('stop Sigma native criteria'),timer=setTimeout(()=>controller.abort(reason),15)
 try{await assert.rejects(createSigmaComputingScraper().run({signal:controller.signal,fetchText:async()=>capture.careersHtml,fetchJson:async url=>url===base+'?content=true'?structuredClone(capture.originalNativePayload):new Promise(()=>{})}),e=>e===reason)}finally{clearTimeout(timer)}
})

test('Sigma final native listing holds only a role removed during the last complete public criteria pass',async()=>{
 let removed
 const{jobs,audit}=await exercise({change:f=>{indiaMutationAt(f,0);indiaMutationAt(f,1)},beforeRead:(f,url,calls)=>{
  if(url!==base+'?content=true'||calls.filter(c=>c===url).length!==3||calls.filter(c=>c.endsWith('?questions=true')).length!==152)return
  removed=f.originalNativePayload.jobs[0].id
  f.originalNativePayload.jobs=f.originalNativePayload.jobs.filter(row=>row.id!==removed)
  f.originalNativePayload.meta.total=75
 }})
 assert.equal(jobs.length,1)
 assert.ok(jobs.every(j=>j.jobId!==String(removed)))
 assert.equal(audit.observedNativeBoardCount,76)
 assert.equal(audit.nativeDetailRecords.length,76)
 assert.equal(audit.finalNativePayload.jobs.length,75)
 assert.equal(audit.closingInventoryStable,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

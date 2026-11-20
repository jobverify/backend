import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))
const replay=(mutate)=>{
 const rows=fixture(),calls=[]
 return {calls,async fetchImpl(url,init){
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');calls.push(url)
  const original=rows.find(row=>row.url===url);assert.ok(original,'Only declared Svaya URLs may be read: '+url)
  const row=mutate?.({...original,body:Buffer.from(original.bodyBase64,'base64').toString()},calls)||original
  const response=new Response(row.body??Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers})
  Object.defineProperty(response,'url',{value:row.url});return response
 }}
}

test('Svaya uses its own employer and seven complete native roles, never the Paninian portal',async()=>{
 assert.equal(source.COMPANY_DOMAIN,'svayarobotics.com')
 assert.equal(source.HOMEPAGE_URL,'https://svayarobotics.com/')
 assert.equal(source.CAREERS_URL,'https://svayarobotics.com/careers/')
 const transport=replay(),jobs=await source.run({...transport,now:()=>new Date('2026-11-19T12:00:00Z')})
 assert.equal(jobs.length,7)
 for(const job of jobs){
  assert.equal(job.company,'Svaya Robotics');assert.equal(job.country,'India')
  assert.match(job.sourceUrl,/^https:\/\/svayarobotics\.com\/job\/[a-z0-9-]+\/$/)
  assert.equal(job.applyUrl,job.sourceUrl);assert.ok(job.sourceDescription.length>1000)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.nativeRoleClosingReconciled,true)
  assert.equal(job.applicationSubmitted,false);assert.equal(job.requisitionId,null)
  assert.ok(job.nativeRoleRecord.criteriaHTML);assert.ok(job.nativeRoleRecord.form)
  assert.ok(!JSON.stringify(job).includes('careers_india@paninian.com'))
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.nativeInventoryCount,7)
 assert.equal(jobs.nativeCollectionEvidence.companyScopeComplete,false)
 assert.ok(transport.calls.every(url=>!url.includes('svayatt.co.in')&&!url.includes('paninian.com')))
})

test('Svaya owns the complete native listing, detail title, geography, criteria and candidate form',()=>{
 const rows=fixture(),html=url=>Buffer.from(rows.find(row=>row.url===url).bodyBase64,'base64').toString()
 const careers=html(source.CAREERS_URL),record=source.readSvayaListing(careers).records[0],role=html(record.url)
 const controls=[
  [role.replace('rel="canonical" href="'+record.url+'"','rel="canonical" href="https://elsewhere.invalid/job/foreign/"'),record],
  [role,{...record,title:'Different native role'}],
  [role.replaceAll('Medchal-Hyderabad','Hyderabad / United States'),{...record,location:'Hyderabad / United States'}],
  [role.replace('class="singal_job_details"','class="singal_job_details" style="display:none"'),record],
  [role.replace('<h3>About Role</h3>','<h3>About Role</h3><p>Job Country: United States.</p>'),record],
  [role.replace('<h3>About Role</h3>','<h3>About Role</h3><p>Employer: Paninian Aerospace;</p>'),record],
  [role.replace('<h3>About Role</h3>','<h3>About Role</h3><p>This position is closed.</p>'),record],
  [role.replace('Experience & Qualification','Qualification missing'),record],
  [role.replace('type="email" name="email"','type="text" name="email"'),record],
  [role.replace('type="text" name="job_position"','type="text" name="job_position" readonly'),record],
  [role.replace('type="file" name="attach_file"','type="file" name="attach_file" disabled'),record],
  [role.replace('action="'+new URL(record.url).pathname+'#wpcf7-f448-o1"','action="https://elsewhere.invalid/apply"'),record],
  [role.replace('</head>','<style>.singal_job_details{display:none}</style></head>'),record],
  [role.replace('</body>','<script>document.querySelector(".singal_job_details").remove()</script></body>'),record],
  [role.replace('<p data-pm-slice="1 1 []">','<p class="d-none" data-pm-slice="1 1 []">'),record],
  [role.replace('class="main_job_singal"','class="main_job_singal d-none"'),record],
  [role.replace('type="text" name="first_name"','type="hidden" name="first_name"'),record],
  [role.replace('type="text" name="first_name"','type="text" hidden name="first_name"'),record],
 ]
 for(const [index,[body,row]] of controls.entries()){
  assert.ok(body!==role||row!==record,'Control changes a native field: '+index)
  assert.throws(()=>source.readSvayaRole(body,row),/native careers/i,'Native rejection control '+index)
 }
 assert.throws(()=>source.readSvayaListing(careers.replace('class="career-job-list"','class="career-job-list" hidden')),/native careers/i)
 assert.throws(()=>source.readSvayaListing(careers.replace(record.url,'https://www.svayatt.co.in/blank-24')),/native careers/i)
})

test('Svaya rejects blocked original HTML and changed complete presentation assets',async()=>{
 for(const target of ['status','asset']){
  const transport=replay(row=>target==='status'&&row.url===source.HOMEPAGE_URL?{...row,status:403}:target==='asset'&&row.url.endsWith('/5.15.4/css/all.min.css')?{...row,body:row.body+'\n.career-job-list{display:none}'}:null)
  await assert.rejects(source.run(transport),/HTTP authority|Complete native client or stylesheet/)
 }
})

test('Svaya opaque caller cancellation and invalid budgets acquire no source bytes',async()=>{
 const reason={caller:'opaque cancellation'},controller=new AbortController();controller.abort(reason)
 let reads=0
 await assert.rejects(source.run({signal:controller.signal,fetchImpl:()=>{reads++;throw Error('Unexpected read')}}),error=>error===reason)
 for(const option of [{sourceTimeoutMs:0},{sourceTimeoutMs:180001},{requestTimeoutMs:15001},{maxJobs:0}])
  await assert.rejects(source.run({...option,fetchImpl:()=>{reads++;throw Error('Unexpected read')}}),/deadline|job limit/)
 assert.equal(reads,0)
})

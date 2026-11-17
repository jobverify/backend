import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,CAREERS_URL,extractPublicRoles,extractCurrentRoleDetails} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const {originals}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261116/current-native.json.gz',import.meta.url))))
const text=p=>Buffer.from(p.bodyBase64,'base64').toString(),listings=extractPublicRoles(text(originals[0]))
const state=html=>JSON.parse(html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1])
function rewrite(html,change){return html.replace(/(<script[^>]+id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const model=JSON.parse(raw);change(model);return start+JSON.stringify(model)+end})}
function replay(change=(s)=>s){
 const calls=new Map(),requests=[]
 return {requests,fetchText:async(url,options={})=>{
  options.signal?.throwIfAborted();requests.push(url)
  const packets=originals.filter(p=>p.url===url),i=calls.get(url)||0;calls.set(url,i+1)
  assert.ok(packets[i],`Missing current physical Filo packet ${url} #${i+1}`)
  assert.equal(packets[i].status,200)
  return change(text(packets[i]),{url,count:i+1})
 }}
}

test('current Filo native deleted flag holds only its bound role and retains19 current India records with original criteria',async()=>{
 const io=replay(),jobs=await run(io)
 assert.equal(jobs.length,19);assert.equal(io.requests.length,50)
 assert.ok(!jobs.some(j=>j.jobId==='59'))
 for(const job of jobs){
  const listing=listings.find(r=>String(r.id)===job.jobId),packet=originals.find(p=>p.url===listing.detailUrl),model=state(text(packet)).props.pageProps.data
  assert.equal(job.sourceDescription,model.job_description)
  assert.deepEqual(job.sourceNativeDetailPayload,model)
  assert.equal(job.country,'India');assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 const audit=jobs.nativeCollectionEvidence
 assert.deepEqual(audit.deletedRoleIds,['59'])
 assert.deepEqual(audit.unqualifiedLocationIds,['63','60','56','52'])
 assert.equal(audit.nativeRoleModelsClosingReconciled,true)
 assert.equal(audit.heldNativeRecords.find(r=>r.id===59).nativeRoleModel.is_deleted,true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('the native deleted observation does not invent country, closure or criteria qualification',()=>{
 const listing=listings.find(r=>r.id===59),html=text(originals.find(p=>p.url===listing.detailUrl))
 assert.throws(()=>extractCurrentRoleDetails(html,listing),error=>{
  assert.equal(error.code,'FILO_NATIVE_ROLE_MARKED_DELETED')
  assert.equal(error.nativeRoleModel.id,59)
  assert.equal(error.countryQualified,false);assert.equal(error.publicationQualified,false)
  assert.equal(error.lifecycleCleanupAllowed,false)
  return true
 })
 for(const change of [m=>m.id=99999,m=>m.slug+='-wrong',m=>m.department_id=99,m=>m.job_title+=' changed',m=>m.apply_link='https://example.com/apply/86',m=>m.job_description='',m=>m.is_deleted='true']){
  const changed=rewrite(html,p=>change(p.props.pageProps.data))
  assert.throws(()=>extractCurrentRoleDetails(changed,listing),error=>error.code!=='FILO_NATIVE_ROLE_MARKED_DELETED')
 }
})

test('the fully hydrated and closing-reconciled Filo cohort preserves 24 advertised records and 23 nondeleted vacancies through main assessment',async()=>{
 const jobs=await run(replay())
 const observation={source:'filo',recordKind:'mixed',observedRecordCount:24,observedVacancyCount:23,
  sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
 assert.deepEqual(readSourceObservationEvidence(jobs,'filo'),observation)
 for(const[key,value]of Object.entries(observation))assert.deepEqual(jobs.nativeCollectionEvidence[key],value)
 const assessment=assessSoftFailureAcquisition({source:'filo'},jobs)
 assert.equal(assessment.rawJobs,19)
 assert.equal(assessment.runnerOutcome.rawRecords,23)
 assert.deepEqual(assessment.runnerOutcome.sourceObservations,observation)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
 assert.equal(assessment.inventoryEvidence.listingComplete,false)
})

test('a caller-capped Filo cohort does not claim observations for unhydrated native records',async()=>{
 const jobs=await run({...replay(),maxJobs:1})
 assert.equal(jobs.length,1)
 assert.equal(jobs.nativeCollectionEvidence.nativeRoleModels.length,1)
 assert.equal(readSourceObservationEvidence(jobs,'filo'),null)
 for(const key of ['recordKind','observedRecordCount','observedVacancyCount'])assert.equal(jobs.nativeCollectionEvidence[key],undefined)
 assert.equal(assessSoftFailureAcquisition({source:'filo'},jobs).runnerOutcome.rawRecords,1)
})

test('Filo rejects closing full role metadata, native criteria, deletion state and listing changes',async(t)=>{
 const first=listings[0],deleted=listings.find(r=>r.id===59)
 for(const[name,url,mutate]of[
  ['criteria',first.detailUrl,p=>p.props.pageProps.data.job_description+='\nNew actual requirement'],
  ['unmapped field',first.detailUrl,p=>p.props.pageProps.data.reviewed_extra_field='changed'],
  ['deleted state',deleted.detailUrl,p=>p.props.pageProps.data.is_deleted=false],
  ['listing',CAREERS_URL,p=>p.props.pageProps.data[0].jobs[0].jobTitle+=' changed'],
 ])await t.test(name,async()=>{
  const io=replay((s,c)=>c.url===url&&c.count===2?rewrite(s,mutate):s)
  await assert.rejects(run(io),/Filo closing/)
 })
})

test('Filo preserves caller cancellation before acquisition and during a closing role read',async()=>{
 const before=new AbortController(),reason=Symbol('Filo caller cancellation');before.abort(reason)
 let reads=0
 await assert.rejects(run({signal:before.signal,fetchText:async()=>{reads++;return text(originals[0])}}),error=>error===reason)
 assert.equal(reads,0)
 const control=new AbortController(),io=replay((s,{url,count})=>{if(url===listings[0].detailUrl&&count===2)control.abort(reason);return s})
 await assert.rejects(run({...io,signal:control.signal}),error=>error===reason)
})

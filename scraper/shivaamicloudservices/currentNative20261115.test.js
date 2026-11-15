import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.filter(p=>p.phase==='opening').map(p=>[p.requestedURL,p]))
const BOARD='https://www.shivaami.com/careers/',MAIN='https://www.shivaami.com/assets/index-DoKRdTmC.js',CAREER='https://www.shivaami.com/assets/Careers-mOwE3exF.js'
function execute(change=()=>{},options={}){
 const visits=new Map(),calls=[]
 const packet=value=>{const url=String(value),p=structuredClone(packets.get(url));assert.ok(p,'Only actual current published GET '+url);const visit=(visits.get(url)||0)+1;visits.set(url,visit);p.body=Buffer.from(p.bodyBase64,'base64').toString();change(p,url,visit);return p}
 const jobs=run({now:()=>fixture.capturedAt,requestIntervalMs:0,...options,fetchText:async value=>packet(value).body,fetchImpl:async(value,init)=>{calls.push({url:String(value),init});const p=packet(value),response=new Response(p.body,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response}})
 return{jobs,calls}
}
test('current property order preserves three full native India roles and holds the city-only fourth',async()=>{
 const result=execute(),jobs=await result.jobs
 assert.deepEqual(jobs.map(j=>j.title),['Inside Sales Representative','Business Development Executive','Assistant Sales Manager'])
 for(const job of jobs){
  assert.equal(job.company,'Shivaami Cloud Services');assert.equal(job.country,'India');assert.equal(job.location,'Mumbai, India')
  assert.equal(job.jobId,null);assert.equal(job.requisitionId,null);assert.equal(job.sourceNativeIdentifier,null)
  assert.equal(job.sourceNativeIdentity.value,job.title);assert.equal(job.sourceNativeIdentity.kind,'current-native-form-profile-title')
  assert.ok(job.jobDescription.startsWith(job.sourceNativeRole.description));assert.ok(job.jobDescription.includes(job.sourceNativeRole.experience))
  for(const benefit of job.sourceNativeCommonBenefits){assert.ok(job.jobDescription.includes(benefit.title));assert.ok(job.jobDescription.includes(benefit.description))}
  assert.equal(job.sourceNativeApplication.selectedProfile,job.title);assert.equal(job.sourceNativeApplication.submissionPerformed,false)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.postingDate,null);assert.equal(job.firstEverPostedAt,null);assert.equal(job.closingDate,null)
 }
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,4);assert.equal(jobs.nativeCollectionEvidence.holds.length,1)
 assert.equal(jobs.nativeCollectionEvidence.holds[0].title,'Inside Sales Executive')
 assert.equal(readSourceObservationEvidence(jobs,'shivaamicloudservices').observedRecordCount,4)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(result.calls.length,20);assert.ok(result.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'))
})
test('current complete program admission rejects opening and closing country/criterion/publisher/application drift',async t=>{
 for(const[name,url,mutate]of[
  ['foreign native country',CAREER,s=>s.replace('Mumbai, India','Mumbai, Nepal')],
  ['omitted full criterion',CAREER,s=>s.replace('Excellent communication and interpersonal skills are a must.','')],
  ['additional original qualification',CAREER,s=>s.replace('location:"Mumbai, India"','qualifications:"A mandatory PhD",location:"Mumbai, India"')],
  ['changed native role identity',CAREER,s=>s.replace('title:"Assistant Sales Manager"','title:"Other Sales Manager"')],
  ['changed native form role selection',CAREER,s=>s.replace('n("profile",t),f()','n("profile","Unrelated role"),f()')],
  ['inactive own entry declaration',BOARD,s=>s.replace('type="module"','type="application/json"')],
  ['explicit visible closure',BOARD,s=>s.replace('</body>','<p>Applications are closed.</p></body>')],
  ['different own legal employer',MAIN,s=>s.replace(' Shivaami Cloud Services. All rights reserved.',' Another Company. All rights reserved.')],
 ])for(const closingOnly of[false,true])await t.test(name+(closingOnly?' closing':' opening'),async()=>{
  let changed=false
  await assert.rejects(execute((p,value,visit)=>{if(value===url&&(!closingOnly||visit>1)){const next=mutate(p.body);assert.notEqual(next,p.body,'Mutation hits genuine native input');p.body=next;changed=true}}).jobs,/Shivaami current native/i)
  assert.equal(changed,true)
 })
})
test('native HTTP denial/final URL changes cannot become empty or positive inventory',async t=>{
 for(const mode of['denied','redirect','mime'])await t.test(mode,async()=>{await assert.rejects(execute((p,url)=>{if(url===BOARD){if(mode==='denied')p.status=403;if(mode==='redirect')p.url='https://another.invalid/careers/';if(mode==='mime')p.headers['content-type']='application/json'}}).jobs,/Shivaami current native/i)})
})
test('opaque caller abort reasons survive without mutation',async t=>{
 for(const reason of['caller-stop',Object.freeze(Error('caller-stop'))])await t.test(typeof reason,async()=>{const c=new AbortController();c.abort(reason);await assert.rejects(execute(undefined,{signal:c.signal}).jobs,error=>error===reason)})
})
test('an uncooperative fetch settles within the source deadline',async()=>{
 const started=Date.now();await assert.rejects(run({sourceDeadlineMs:35,fetchImpl:()=>new Promise(()=>{})}),/deadline/i);assert.ok(Date.now()-started<1000)
})
test('legacy body-only transport cannot qualify native inventory',async()=>{await assert.rejects(run({fetchText:async()=>''}),/metadata/i)})

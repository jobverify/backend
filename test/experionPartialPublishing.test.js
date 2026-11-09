import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import test,{after} from 'node:test'
import {createReviewedProofRuntime,readReviewedSnapshot} from './helpers/reviewedProofRuntime.js'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {buildPartialAttempt,recordPartialPublishingStatus} from '../scripts/partialPublishingGapEvidence.js'
import {isSuccessfulPublishingGapTrial} from '../scripts/publishPublishingGapRepairs.js'
const now=new Date('2026-10-21T00:55:00Z'),sha=b=>createHash('sha256').update(b).digest('hex'),url=new URL('../scripts/experionPartialPublishingEvidence.js',import.meta.url)
const load=async()=>{assert.ok(fs.existsSync(url),'Experion exact partial proof implementation is required');return import(runtime.url('scripts/experionPartialPublishingEvidence.js'))}
const fixture=()=>{const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/experionPartial/reviewed-native-001.json.gz',import.meta.url)))),files=new Map(Object.entries(f.files).map(([k,v])=>[k,Buffer.from(v,'base64')]));return{source:'experiontechnologies',httpEvidence:f.httpEvidence,files,readEvidence:async file=>files.get(file),now}}
// Positive and mutation cases replay the immutable reviewed runtime, including
// the actual Oct21 eligibility policy from git7ebb487d0, before posting-age filtering.
const runtime=createReviewedProofRuntime(fixture(),{prefix:'experion-reviewed-proof-',extraFiles:new Map([['scraper-support/utils/publishableJobMetrics.js',readReviewedSnapshot(new URL('./fixtures/aeriesPartial/reviewed-publishableJobMetrics-7ebb487d0.js.gz',import.meta.url),'f7d4baf7d52d6f3efd0fe23e5adbfff820f53194f3a3ddfbe7a0982d385b0621')]])})
after(runtime.cleanup)
test('experion verifier rejects changed reviewed source bytes and checkout drift',async()=>{
 const {deriveExperionPartialEvidence}=await import(url)
 const f=fixture(),drift=f.httpEvidence.receipts.filter(r=>r.sourcePath).some(r=>sha(fs.readFileSync(new URL('../'+r.sourcePath,import.meta.url)))!==r.sha256)
 if(drift)await assert.rejects(deriveExperionPartialEvidence(f),/current (?:source|extraction code).*differs/)
 else await assert.rejects(deriveExperionPartialEvidence(f),/every selected role must remain eligible now/)
 const receipt=f.httpEvidence.receipts.find(r=>r.kind==='current-code'),file=runtime.url(receipt.sourcePath),bytes=fs.readFileSync(file)
 try {
  fs.writeFileSync(file,Buffer.concat([bytes,Buffer.from('\n// changed source bytes\n')]))
  const {deriveExperionPartialEvidence:deriveReviewed}=await load()
  await assert.rejects(deriveReviewed(f),/current source.*differs/)
 } finally {fs.writeFileSync(file,bytes)}
})

async function makeTrial(f=fixture()){
 const{deriveExperionPartialEvidence}=await load(),p=await deriveExperionPartialEvidence(f)
 const trial={schemaVersion:1,source:'experiontechnologies',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence:f.httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeRemoteScopeEvidence:p.nativeRemoteScopeEvidence,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,
  rawJobs:29,indiaJobs:null,globalTotal:null,observedSelectedIndia:29,jobs:p.jobs}
 return{trial,bytes:Buffer.from(JSON.stringify(trial)),readEvidence:f.readEvidence,now:f.now}
}
test('Experion exact33-response proof accepts29 unchanged India-office roles and preserves four unknown Remote scopes and original publication dates',async()=>{
 const{verifyExperionPartialPublishingTrial}=await load(),args=await makeTrial(),p=await verifyExperionPartialPublishingTrial(args)
 assert.equal(p.eligibleJobs,29);assert.equal(p.rawTotal,29);assert.equal(p.indiaTotal,null);assert.equal(p.publicTotal,null);assert.equal(p.nativeBoardEvidence.observedNativeCards,29);assert.equal(p.nativeRemoteScopeEvidence.length,4)
 assert.ok(p.jobs.every(j=>j.sourceListingComplete===false&&j.sourceDetailComplete===true));assert.equal(p.jobs.filter(j=>j.nativeRemoteScopeUnknown).length,4);assert.equal(p.companyScope.complete,false);assert.equal(p.companyScope.globalTotal,null);assert.equal(p.companyScope.indiaTotal,null)
 assert.equal(p.detailHealth.complete,false);assert.equal(p.detailHealth.missingDescriptions,0);assert.equal(p.selectedDetailHealth.complete,true);assert.ok(Object.values(p.filterCounts).every(v=>v===null));assert.equal(p.replayEvidence.responsesUsed,33)
 const original=JSON.parse(await args.readEvidence('evidence/frozen-trials/experiontechnologies.json'));assert.deepEqual(p.jobs,original.jobs);assert.equal(p.startedAt,original.attemptedAt);assert.equal(p.capturedAt,original.completedAt);assert.equal(isSuccessfulPublishingGapTrial(args.trial,{source:'experiontechnologies',now}),false)
 const attempt=buildPartialAttempt(p,{inserted:29,updated:0,deleted:0,expired:0,missed:0},now),updates=[];await recordPartialPublishingStatus({collection:()=>({updateOne:async(_q,u)=>{updates.push(u);return{matchedCount:1}}})},'experiontechnologies',attempt)
 assert.equal(attempt.rawRecords,29);assert.equal(attempt.jobs,null);assert.equal(attempt.eligibleJobs,29);assert.equal(attempt.success,false);assert.equal(updates[0].$set.lastSuccess,false);assert.ok(Object.keys(updates[0].$set).every(k=>!k.startsWith('lastComplete')))
 for(const key of ['filteredEmptyDescription','filteredNonIndia','filteredInvalidUrl','filteredClosed','filteredNonJob','filteredOld'])assert.equal(attempt[key],null)
})
test('Experion changed native jobs, Remote scope, company totals, dates, application URLs and complete health cannot qualify',async()=>{
 const{verifyExperionPartialPublishingTrial}=await load(),base=await makeTrial()
 for(const change of [t=>{t.source='other'},t=>{t.maxJobs=1},t=>{t.truncated=true},t=>{t.jobs.pop()},t=>{t.rawJobs=28},t=>{t.indiaJobs=29},t=>{t.globalTotal=29},t=>{t.jobs[0].jobId='fake'},t=>{t.jobs[0].title='Fake role'},t=>{t.jobs[0].city='Paris'},t=>{t.jobs[0].applyUrl='https://example.com/apply'},t=>{t.jobs[0].jobDescription='Hidden metadata'},t=>{t.jobs[0].postingDate=t.completedAt},t=>{t.jobs[0].nativePagePublishedAt=t.completedAt},t=>{t.jobs.find(j=>j.nativeRemoteScopeUnknown).nativeRemoteScopeUnknown=false},t=>{t.jobs[0].sourceListingComplete=true},
  t=>{t.nativeRemoteScopeEvidence=[]},t=>{t.nativeBoardEvidence.observedNativeCards=0},t=>{t.companyScope.complete=true},t=>{t.companyScope.indiaTotal=29},t=>{t.detailHealth.complete=true},t=>{t.filterCounts.nonIndia=0},t=>{t.completedAt='2026-10-21T00:50:00Z'},
 ]){const trial=structuredClone(base.trial);change(trial);await assert.rejects(verifyExperionPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}),change.toString())}
})
test('Experion stale, missing, duplicate, changed or caller-rehashed native/client/root/current-code evidence fails closed',async()=>{
 const{deriveExperionPartialEvidence}=await load()
 for(const change of [f=>{f.httpEvidence.receipts.pop()},f=>{f.httpEvidence.receipts.push({...f.httpEvidence.receipts[0]})},f=>{f.now=new Date('2026-10-24T00:55:00Z')},
 ...['independent-review','corrected-replay','corrected-code-attestation','capture-manifest','catalog-trial','current-code','native'].map(kind=>f=>{const r=f.httpEvidence.receipts.find(r=>r.kind===kind);f.files.set(r.file,Buffer.from('{}'))}),
 f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='native'&&r.originFile==='003.json'),p=JSON.parse(f.files.get(r.file));p.body='Invented client with no pagination';p.bodySha256=sha(p.body);const bytes=Buffer.from(JSON.stringify(p));f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes)},
 ]){const f=fixture();change(f);await assert.rejects(deriveExperionPartialEvidence(f))}
})

test('Experion immutable freezer keeps29 original jobs/dates and all33 actual packets and refuses reused or escaping outputs',async()=>{
 const url=runtime.url('scripts/freezeExperionPartialPublishingTrial.js');assert.ok(fs.existsSync(url),'Experion immutable freezer is required')
 const{freezeExperionPartialTrial}=await import(url),parent=fs.mkdtempSync(path.join(os.tmpdir(),'experion-proof-')),outputDirectory=path.join(parent,'release')
 try{
  const f=fixture(),result=await freezeExperionPartialTrial({...f,outputDirectory}),bytes=fs.readFileSync(path.join(outputDirectory,'experiontechnologies.json')),trial=JSON.parse(bytes),original=JSON.parse(f.files.get('evidence/frozen-trials/experiontechnologies.json'))
  assert.equal(result.trialByteHash,sha(bytes));assert.equal(result.eligibleJobs,29);assert.equal(result.indiaJobs,null);assert.equal(result.unboundedRemoteScopes,4);assert.deepEqual(trial.jobs,original.jobs);assert.equal(trial.attemptedAt,original.attemptedAt);assert.equal(trial.completedAt,original.completedAt)
  for(const[file,body]of f.files)assert.deepEqual(fs.readFileSync(path.join(outputDirectory,file)),body)
  await assert.rejects(freezeExperionPartialTrial({...f,outputDirectory}))
  const bad=fixture();bad.httpEvidence.receipts[0].file='../escape.json';const badOutput=path.join(parent,'bad');await assert.rejects(freezeExperionPartialTrial({...bad,outputDirectory:badOutput}));assert.equal(fs.existsSync(badOutput),false)
 }finally{assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('experion-proof-'));fs.rmSync(parent,{recursive:true})}
})

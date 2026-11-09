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
const now=new Date('2026-10-21T03:00:00Z'),sha=b=>createHash('sha256').update(b).digest('hex'),url=new URL('../scripts/indigoPartialPublishingEvidence.js',import.meta.url)
const load=async()=>{assert.ok(fs.existsSync(url),'Indigo exact partial proof implementation is required');return import(runtime.url('scripts/indigoPartialPublishingEvidence.js'))}
const fixture=()=>{const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/indigoPartial/reviewed-native-001.json.gz',import.meta.url)))),files=new Map(Object.entries(f.files).map(([k,v])=>[k,Buffer.from(v,'base64')]));return{source:'indigo',httpEvidence:f.httpEvidence,files,readEvidence:async file=>files.get(file),now}}
// Positive and mutation cases replay the immutable reviewed runtime, including
// the actual Oct21 eligibility policy from git7ebb487d0, before posting-age filtering.
const runtime=createReviewedProofRuntime(fixture(),{prefix:'indigo-reviewed-proof-',extraFiles:new Map([['scraper-support/utils/publishableJobMetrics.js',readReviewedSnapshot(new URL('./fixtures/aeriesPartial/reviewed-publishableJobMetrics-7ebb487d0.js.gz',import.meta.url),'f7d4baf7d52d6f3efd0fe23e5adbfff820f53194f3a3ddfbe7a0982d385b0621')]])})
after(runtime.cleanup)
test('indigo verifier rejects changed reviewed source bytes and checkout drift',async()=>{
 const {deriveIndigoPartialEvidence}=await import(url)
 const f=fixture(),drift=f.httpEvidence.receipts.filter(r=>r.sourcePath).some(r=>sha(fs.readFileSync(new URL('../'+r.sourcePath,import.meta.url)))!==r.sha256)
 if(drift)await assert.rejects(deriveIndigoPartialEvidence(f),/current (?:source|extraction code).*differs/)
 else await assert.rejects(deriveIndigoPartialEvidence(f),/every selected role must remain eligible now/)
 const receipt=f.httpEvidence.receipts.find(r=>r.kind==='current-code'),file=runtime.url(receipt.sourcePath),bytes=fs.readFileSync(file)
 try {
  fs.writeFileSync(file,Buffer.concat([bytes,Buffer.from('\n// changed source bytes\n')]))
  const {deriveIndigoPartialEvidence:deriveReviewed}=await load()
  await assert.rejects(deriveReviewed(f),/current source.*differs/)
 } finally {fs.writeFileSync(file,bytes)}
})

async function makeTrial(f=fixture()){
 const{deriveIndigoPartialEvidence}=await load(),p=await deriveIndigoPartialEvidence(f)
 const trial={schemaVersion:1,source:'indigo',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence:f.httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,excludedNativeRoles:p.excludedNativeRoles,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,
  rawJobs:21,indiaJobs:null,globalTotal:null,observedSelectedIndia:19,jobs:p.jobs}
 return{trial,bytes:Buffer.from(JSON.stringify(trial)),readEvidence:f.readEvidence,now:f.now}
}
test('Indigo exact six-response proof selects19 unchanged healthy roles while retaining two placeholders and unknown company/application-page scope',async()=>{
 const{verifyIndigoPartialPublishingTrial}=await load(),args=await makeTrial(),p=await verifyIndigoPartialPublishingTrial(args)
 assert.equal(p.eligibleJobs,19);assert.equal(p.rawTotal,21);assert.equal(p.indiaTotal,null);assert.equal(p.publicTotal,null)
 assert.equal(p.nativeBoardEvidence.observedNativeRecords,21);assert.equal(p.nativeBoardEvidence.scopedIndiaOfficeRoles,21);assert.equal(p.nativeBoardEvidence.selectedHealthyIndiaJobs,19);assert.equal(p.nativeBoardEvidence.missingNativeDescriptions,2);assert.equal(p.nativeBoardEvidence.applicationPageAccessibility,null)
 assert.deepEqual(p.excludedNativeRoles.map(j=>j.jobId),['6871','6872']);assert.ok(p.excludedNativeRoles.every(j=>j.reason==='native-full-description-missing-or-placeholder'))
 assert.ok(p.jobs.every(j=>j.sourceListingComplete===false&&j.sourceDetailComplete===true&&j.nativeEmployer==='InterGlobe Aviation limited'));assert.equal(p.companyScope.complete,false);assert.equal(p.companyScope.globalTotal,null);assert.equal(p.companyScope.indiaTotal,null)
 assert.equal(p.detailHealth.complete,false);assert.equal(p.detailHealth.missingDescriptions,2);assert.equal(p.selectedDetailHealth.complete,true);assert.ok(Object.values(p.filterCounts).every(v=>v===null));assert.equal(p.replayEvidence.responsesUsed,6)
 const original=JSON.parse(await args.readEvidence('evidence/frozen-trials/indigo.json'));assert.deepEqual(p.jobs,original.jobs.filter(j=>j.sourceDetailComplete));assert.equal(p.startedAt,original.attemptedAt);assert.equal(p.capturedAt,original.completedAt);assert.equal(isSuccessfulPublishingGapTrial(args.trial,{source:'indigo',now}),false)
 const attempt=buildPartialAttempt(p,{inserted:19,updated:0,deleted:0,expired:0,missed:0},now),updates=[];await recordPartialPublishingStatus({collection:()=>({updateOne:async(_q,u)=>{updates.push(u);return{matchedCount:1}}})},'indigo',attempt)
 assert.equal(attempt.rawRecords,21);assert.equal(attempt.jobs,null);assert.equal(attempt.eligibleJobs,19);assert.equal(attempt.success,false);assert.equal(updates[0].$set.lastSuccess,false);assert.ok(Object.keys(updates[0].$set).every(k=>!k.startsWith('lastComplete')))
 for(const key of ['filteredEmptyDescription','filteredNonIndia','filteredInvalidUrl','filteredClosed','filteredNonJob','filteredOld'])assert.equal(attempt[key],null)
})
test('Indigo mutated selected fields, included placeholders, fabricated totals, application success and complete health never qualify',async()=>{
 const{verifyIndigoPartialPublishingTrial}=await load(),base=await makeTrial(),original=JSON.parse(await base.readEvidence('evidence/frozen-trials/indigo.json'))
 for(const change of [t=>{t.source='other'},t=>{t.maxJobs=1},t=>{t.truncated=true},t=>{t.jobs.pop()},t=>{t.jobs.push(original.jobs.find(j=>!j.sourceDetailComplete))},t=>{t.rawJobs=19},t=>{t.indiaJobs=21},t=>{t.globalTotal=21},t=>{t.jobs[0].jobId='fake'},t=>{t.jobs[0].title='Fake role'},t=>{t.jobs[0].city='Paris'},t=>{t.jobs[0].country='United States'},t=>{t.jobs[0].nativeEmployer='Other Employer'},t=>{t.jobs[0].applyUrl='https://example.com/apply'},t=>{t.jobs[0].jobDescription='Apply now'},t=>{t.jobs[0].postingDate=t.completedAt},t=>{t.jobs[0].closingDate=t.completedAt},t=>{t.jobs[0].sourceListingComplete=true},t=>{t.excludedNativeRoles=[]},t=>{t.nativeBoardEvidence.observedNativeRecords=0},t=>{t.nativeBoardEvidence.applicationPageAccessibility=true},t=>{t.companyScope.complete=true},t=>{t.companyScope.indiaTotal=21},t=>{t.detailHealth.complete=true},t=>{t.filterCounts.nonIndia=0},t=>{t.completedAt='2026-10-21T02:00:00Z'}]){const trial=structuredClone(base.trial);change(trial);await assert.rejects(verifyIndigoPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}),change.toString())}
})
for(const marker of ['success','extractionComplete'])test('Indigo explicit '+marker+' marker cannot relabel a partial trial',async()=>{
 const{verifyIndigoPartialPublishingTrial}=await load(),base=await makeTrial(),trial=structuredClone(base.trial);trial[marker]=true
 await assert.rejects(verifyIndigoPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}))
})
test('Indigo stale, missing, duplicate, relabelled or caller-rehashed native/client/review/current-code/provider evidence fails',async()=>{
 const{deriveIndigoPartialEvidence}=await load()
 for(const change of [f=>{f.httpEvidence.receipts.pop()},f=>{f.httpEvidence.receipts.push({...f.httpEvidence.receipts[0]})},f=>{f.now=new Date('2026-10-24T03:00:00Z')},f=>{f.httpEvidence.mode='generic-positive'},
 ...['independent-review','corrected-replay','corrected-code-attestation','capture-manifest','catalog-trial','current-code','current-provider','native'].map(kind=>f=>{const r=f.httpEvidence.receipts.find(r=>r.kind===kind);f.files.set(r.file,Buffer.from('{}'))}),
 f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='native'&&r.originFile==='005.json'),p=JSON.parse(f.files.get(r.file));const body=JSON.parse(p.body);body.result[0].jobReqLocale.results[0].externalJobDescription='Invented role';p.body=JSON.stringify(body);p.bodySha256=sha(p.body);const bytes=Buffer.from(JSON.stringify(p));f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes)},
 f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='current-code');const bytes=Buffer.from('// caller invented reviewed code');f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes)},
 ]){const f=fixture();change(f);await assert.rejects(deriveIndigoPartialEvidence(f))}
})
test('Indigo immutable freezer preserves19 original jobs/dates and all six packets, refuses reused or escaping outputs',async()=>{
 const url=runtime.url('scripts/freezeIndigoPartialPublishingTrial.js');assert.ok(fs.existsSync(url),'Indigo immutable freezer is required')
 const{freezeIndigoPartialTrial}=await import(url),parent=fs.mkdtempSync(path.join(os.tmpdir(),'indigo-proof-')),outputDirectory=path.join(parent,'release')
 try{const f=fixture(),result=await freezeIndigoPartialTrial({...f,outputDirectory}),bytes=fs.readFileSync(path.join(outputDirectory,'indigo.json')),trial=JSON.parse(bytes),original=JSON.parse(f.files.get('evidence/frozen-trials/indigo.json'));assert.equal(result.trialByteHash,sha(bytes));assert.equal(result.eligibleJobs,19);assert.equal(result.indiaJobs,null);assert.equal(result.missingDescriptions,2);assert.deepEqual(trial.jobs,original.jobs.filter(j=>j.sourceDetailComplete));assert.equal(trial.attemptedAt,original.attemptedAt);assert.equal(trial.completedAt,original.completedAt);for(const[file,body]of f.files)assert.deepEqual(fs.readFileSync(path.join(outputDirectory,file)),body);await assert.rejects(freezeIndigoPartialTrial({...f,outputDirectory}));const bad=fixture();bad.httpEvidence.receipts[0].file='../escape.json';const badOutput=path.join(parent,'bad');await assert.rejects(freezeIndigoPartialTrial({...bad,outputDirectory:badOutput}));assert.equal(fs.existsSync(badOutput),false)}finally{assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('indigo-proof-'));fs.rmSync(parent,{recursive:true})}
})

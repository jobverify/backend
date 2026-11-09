import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import test,{after} from 'node:test'
import {createReviewedProofRuntime} from './helpers/reviewedProofRuntime.js'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {buildPartialAttempt,recordPartialPublishingStatus} from '../scripts/partialPublishingGapEvidence.js'
import {isSuccessfulPublishingGapTrial} from '../scripts/publishPublishingGapRepairs.js'
const now=new Date('2026-10-21T04:00:00Z'),sha=b=>createHash('sha256').update(b).digest('hex'),url=new URL('../scripts/castrolPartialPublishingEvidence.js',import.meta.url)
const load=async()=>{assert.ok(fs.existsSync(url),'Castrol exact partial proof implementation is required');return import(runtime.url('scripts/castrolPartialPublishingEvidence.js'))}
const fixture=()=>{const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/castrolPartial/reviewed-native-001.json.gz',import.meta.url)))),files=new Map(Object.entries(f.files).map(([k,v])=>[k,Buffer.from(v,'base64')]));return{source:'castrolindia',httpEvidence:f.httpEvidence,files,readEvidence:async file=>files.get(file),now}}
// Positive and mutation cases replay the immutable reviewed runtime.
const runtime=createReviewedProofRuntime(fixture(),{prefix:'castrol-reviewed-proof-'})
after(runtime.cleanup)
test('castrol verifier rejects changed reviewed source bytes and checkout drift',async()=>{
 const {deriveCastrolPartialEvidence}=await import(url)
 const f=fixture(),drift=f.httpEvidence.receipts.filter(r=>r.sourcePath).some(r=>sha(fs.readFileSync(new URL('../'+r.sourcePath,import.meta.url)))!==r.sha256)
 if(drift)await assert.rejects(deriveCastrolPartialEvidence(f),/current (?:source|extraction code).*differs/)
 const receipt=f.httpEvidence.receipts.find(r=>r.kind==='current-code'),file=runtime.url(receipt.sourcePath),bytes=fs.readFileSync(file)
 try {
  fs.writeFileSync(file,Buffer.concat([bytes,Buffer.from('\n// changed source bytes\n')]))
  const {deriveCastrolPartialEvidence:deriveReviewed}=await load()
  await assert.rejects(deriveReviewed(f),/current source.*differs/)
 } finally {fs.writeFileSync(file,bytes)}
})

async function makeTrial(f=fixture()){
 const{deriveCastrolPartialEvidence}=await load(),p=await deriveCastrolPartialEvidence(f)
 const trial={schemaVersion:1,source:'castrolindia',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence:f.httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeUnresolvedScopeEvidence:p.nativeUnresolvedScopeEvidence,derivedFieldCorrections:p.derivedFieldCorrections,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,
  rawJobs:101,indiaJobs:null,globalTotal:null,observedSelectedIndia:21,jobs:p.jobs}
 return{trial,bytes:Buffer.from(JSON.stringify(trial)),readEvidence:f.readEvidence,now:f.now}
}
test('Castrol exact25-response proof selects21 explicit India-capable full roles, retaining global scope gaps and one honest derived canonical correction',async()=>{
 const{verifyCastrolPartialPublishingTrial}=await load(),args=await makeTrial(),p=await verifyCastrolPartialPublishingTrial(args)
 assert.equal(p.eligibleJobs,21);assert.equal(p.rawTotal,101);assert.equal(p.indiaTotal,null);assert.equal(p.publicTotal,null);assert.equal(p.nativeBoardEvidence.observedNativeRecords,101);assert.equal(p.nativeBoardEvidence.scopedExplicitIndiaCapableRoles,21);assert.equal(p.nativeBoardEvidence.missingNativeDescriptions,0);assert.equal(p.nativeBoardEvidence.completeIndiaTotal,null)
 assert.deepEqual(p.nativeUnresolvedScopeEvidence.map(j=>j.jobId).sort(),['4983338101','4996789101']);assert.equal(p.derivedFieldCorrections.length,1)
 const mixed=p.jobs.find(j=>j.jobId==='4983338101');assert.equal(mixed.country,'India');assert.equal(mixed.city,'Mumbai');assert.equal(mixed.nativeOffices[0].country,'GB');assert.match(mixed.nativeLocation,/China.*India.*London/);assert.equal(mixed.sourceScopeComplete,false)
 assert.ok(p.jobs.every(j=>j.sourceListingComplete===false&&j.sourceDetailComplete===true&&j.nativeEmployer==='Castrol'));assert.equal(p.companyScope.complete,false);assert.equal(p.companyScope.globalTotal,null);assert.equal(p.companyScope.indiaTotal,null);assert.equal(p.detailHealth.complete,false);assert.equal(p.detailHealth.missingDescriptions,0);assert.equal(p.selectedDetailHealth.complete,true);assert.ok(Object.values(p.filterCounts).every(v=>v===null));assert.equal(p.replayEvidence.responsesUsed,25)
 const corrected=JSON.parse(await args.readEvidence('evidence/frozen-trials/castrolindia-corrected-019.json'));assert.deepEqual(p.jobs,corrected.jobs);assert.equal(p.startedAt,corrected.attemptedAt);assert.equal(p.capturedAt,corrected.completedAt);assert.equal(p.originalCapture.captureTimeDependencyHashes,null);assert.equal(isSuccessfulPublishingGapTrial(args.trial,{source:'castrolindia',now}),false)
 const attempt=buildPartialAttempt(p,{inserted:21,updated:0,deleted:0,expired:0,missed:0},now),updates=[];await recordPartialPublishingStatus({collection:()=>({updateOne:async(_q,u)=>{updates.push(u);return{matchedCount:1}}})},'castrolindia',attempt)
 assert.equal(attempt.rawRecords,101);assert.equal(attempt.jobs,null);assert.equal(attempt.eligibleJobs,21);assert.equal(attempt.success,false);assert.equal(updates[0].$set.lastSuccess,false);assert.ok(Object.keys(updates[0].$set).every(k=>!k.startsWith('lastComplete')));for(const key of ['filteredEmptyDescription','filteredNonIndia','filteredInvalidUrl','filteredClosed','filteredNonJob','filteredOld'])assert.equal(attempt[key],null)
})
test('Castrol mutated fields, relabelled geography, erased scope/correction, fabricated totals or complete health never qualify',async()=>{
 const{verifyCastrolPartialPublishingTrial}=await load(),base=await makeTrial()
 for(const change of [t=>{t.source='other'},t=>{t.maxJobs=1},t=>{t.truncated=true},t=>{t.jobs.pop()},t=>{t.rawJobs=21},t=>{t.indiaJobs=21},t=>{t.globalTotal=101},t=>{t.jobs[0].jobId='fake'},t=>{t.jobs[0].title='Fake role'},t=>{t.jobs[0].city='Paris'},t=>{t.jobs[0].country='United States'},t=>{t.jobs[0].nativeEmployer='BP'},t=>{t.jobs[0].applyUrl='https://example.com/apply'},t=>{t.jobs[0].jobDescription='Sample'},t=>{t.jobs[0].postingDate=t.completedAt},t=>{t.jobs[0].closingDate=t.completedAt},t=>{t.jobs[0].sourceListingComplete=true},t=>{t.jobs.find(j=>j.jobId==='4983338101').nativeOffices[0].country='UK'},t=>{t.derivedFieldCorrections=[]},t=>{t.nativeUnresolvedScopeEvidence=[]},t=>{t.nativeBoardEvidence.observedNativeRecords=0},t=>{t.nativeBoardEvidence.completeIndiaTotal=21},t=>{t.companyScope.complete=true},t=>{t.companyScope.indiaTotal=21},t=>{t.detailHealth.complete=true},t=>{t.filterCounts.nonIndia=80},t=>{t.completedAt='2026-10-21T02:00:00Z'}]){const trial=structuredClone(base.trial);change(trial);await assert.rejects(verifyCastrolPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}),change.toString())}
})
for(const marker of ['success','extractionComplete'])test('Castrol explicit '+marker+' marker cannot relabel a partial trial',async()=>{const{verifyCastrolPartialPublishingTrial}=await load(),base=await makeTrial(),trial=structuredClone(base.trial);trial[marker]=true;await assert.rejects(verifyCastrolPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}))})
test('Castrol stale, missing, duplicate, rewritten native/client/review/current-code/dependency/provider evidence fails',async()=>{
 const{deriveCastrolPartialEvidence}=await load()
 for(const change of [f=>{f.httpEvidence.receipts.pop()},f=>{f.httpEvidence.receipts.push({...f.httpEvidence.receipts[0]})},f=>{f.now=new Date('2026-10-24T04:00:00Z')},f=>{f.httpEvidence.mode='generic-positive'},
 ...['independent-review','corrected-replay','capture-manifest','original-catalog-trial','corrected-catalog-trial','current-code','current-dependency','current-provider','native'].map(kind=>f=>{const r=f.httpEvidence.receipts.find(r=>r.kind===kind);f.files.set(r.file,Buffer.from('{}'))}),
 f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='native'&&r.originFile==='004.json'),p=JSON.parse(f.files.get(r.file));p.body='Invented full JD';p.bodySha256=sha(p.body);const bytes=Buffer.from(JSON.stringify(p));f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes)},
 f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='current-code');const bytes=Buffer.from('// invented reviewed source');f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes)},
 ]){const f=fixture();change(f);await assert.rejects(deriveCastrolPartialEvidence(f))}
})
test('Castrol immutable freezer preserves21 corrected original jobs/dates and all25 packets, refuses reused or escaping outputs',async()=>{
 const url=runtime.url('scripts/freezeCastrolPartialPublishingTrial.js');assert.ok(fs.existsSync(url),'Castrol immutable freezer is required');const{freezeCastrolPartialTrial}=await import(url),parent=fs.mkdtempSync(path.join(os.tmpdir(),'castrol-proof-')),outputDirectory=path.join(parent,'release')
 try{const f=fixture(),result=await freezeCastrolPartialTrial({...f,outputDirectory}),bytes=fs.readFileSync(path.join(outputDirectory,'castrolindia.json')),trial=JSON.parse(bytes),corrected=JSON.parse(f.files.get('evidence/frozen-trials/castrolindia-corrected-019.json'));assert.equal(result.trialByteHash,sha(bytes));assert.equal(result.eligibleJobs,21);assert.equal(result.indiaJobs,null);assert.equal(result.missingDescriptions,0);assert.deepEqual(trial.jobs,corrected.jobs);assert.equal(trial.attemptedAt,corrected.attemptedAt);assert.equal(trial.completedAt,corrected.completedAt);for(const[file,body]of f.files)assert.deepEqual(fs.readFileSync(path.join(outputDirectory,file)),body);await assert.rejects(freezeCastrolPartialTrial({...f,outputDirectory}));const bad=fixture();bad.httpEvidence.receipts[0].file='../escape.json';const badOutput=path.join(parent,'bad');await assert.rejects(freezeCastrolPartialTrial({...bad,outputDirectory:badOutput}));assert.equal(fs.existsSync(badOutput),false)}finally{assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('castrol-proof-'));fs.rmSync(parent,{recursive:true})}
})

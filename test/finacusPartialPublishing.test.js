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
const now=new Date('2026-10-21T04:00:00Z'),sha=b=>createHash('sha256').update(b).digest('hex'),url=new URL('../scripts/finacusPartialPublishingEvidence.js',import.meta.url)
const load=async()=>{assert.ok(fs.existsSync(url),'Finacus exact partial proof implementation is required');return import(runtime.url('scripts/finacusPartialPublishingEvidence.js'))}
const fixture=()=>{const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/finacusPartial/reviewed-native-001.json.gz',import.meta.url)))),files=new Map(Object.entries(f.files).map(([k,v])=>[k,Buffer.from(v,'base64')]));return{source:'finacussolutions',httpEvidence:f.httpEvidence,files,readEvidence:async file=>files.get(file),now}}
// Positive and mutation cases replay the immutable reviewed runtime.
const runtime=createReviewedProofRuntime(fixture(),{prefix:'finacus-reviewed-proof-'})
after(runtime.cleanup)
test('finacus verifier rejects changed reviewed source bytes and checkout drift',async()=>{
 const {deriveFinacusPartialEvidence}=await import(url)
 const f=fixture(),drift=f.httpEvidence.receipts.filter(r=>r.sourcePath).some(r=>sha(fs.readFileSync(new URL('../'+r.sourcePath,import.meta.url)))!==r.sha256)
 if(drift)await assert.rejects(deriveFinacusPartialEvidence(f),/current (?:source|extraction code).*differs/)
 const receipt=f.httpEvidence.receipts.find(r=>r.kind==='current-code'),file=runtime.url(receipt.sourcePath),bytes=fs.readFileSync(file)
 try {
  fs.writeFileSync(file,Buffer.concat([bytes,Buffer.from('\n// changed source bytes\n')]))
  const {deriveFinacusPartialEvidence:deriveReviewed}=await load()
  await assert.rejects(deriveReviewed(f),/current source.*differs/)
 } finally {fs.writeFileSync(file,bytes)}
})

async function makeTrial(f=fixture()){
 const{deriveFinacusPartialEvidence}=await load(),p=await deriveFinacusPartialEvidence(f)
 const trial={schemaVersion:1,source:'finacussolutions',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence:f.httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeUnresolvedScopeEvidence:p.nativeUnresolvedScopeEvidence,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,
  rawJobs:20,indiaJobs:null,globalTotal:null,observedSelectedIndia:20,jobs:p.jobs}
 return{trial,bytes:Buffer.from(JSON.stringify(trial)),readEvidence:f.readEvidence,now:f.now}
}
test('Finacus exact26 responses select20 native full roles with generic application IDs and unresolved regional/company scope intact',async()=>{
 const{verifyFinacusPartialPublishingTrial}=await load(),args=await makeTrial(),p=await verifyFinacusPartialPublishingTrial(args)
 assert.equal(p.eligibleJobs,20);assert.equal(p.rawTotal,20);assert.equal(p.indiaTotal,null);assert.equal(p.publicTotal,null);assert.equal(p.nativeBoardEvidence.observedNativeCards,20);assert.equal(p.nativeBoardEvidence.selectedHealthyIndiaJobs,20);assert.equal(p.nativeBoardEvidence.completeIndiaTotal,null);assert.equal(p.nativeBoardEvidence.missingNativeDescriptions,0)
 const regional=p.jobs.find(j=>j.jobId==='602');assert.equal(regional.city,null);assert.equal(regional.locations.length,5);assert.deepEqual(regional.nativeUnresolvedLocations,['South Region']);assert.equal(regional.sourceScopeComplete,false);assert.match(regional.nativeLocation,/South Region/);assert.deepEqual(p.nativeUnresolvedScopeEvidence.map(j=>j.jobId),['602'])
 assert.equal(new Set(p.jobs.map(j=>j.jobId)).size,20);assert.equal(new Set(p.jobs.map(j=>j.applyUrl)).size,1);assert.ok(p.jobs.every(j=>j.applicationUrlIsGeneric===true&&j.sourceListingComplete===false&&j.sourceDetailComplete===true&&j.postingDate===null&&j.postedAt===null&&j.closingDate===null));assert.equal(p.companyScope.complete,false);assert.equal(p.companyScope.globalTotal,null);assert.equal(p.companyScope.indiaTotal,null);assert.equal(p.detailHealth.complete,false);assert.equal(p.detailHealth.missingDescriptions,0);assert.equal(p.selectedDetailHealth.complete,true);assert.ok(Object.values(p.filterCounts).every(v=>v===null));assert.equal(p.replayEvidence.responsesUsed,26)
 const original=JSON.parse(await args.readEvidence('evidence/frozen-trials/finacussolutions.json'));assert.deepEqual(p.jobs,original.jobs);assert.equal(p.startedAt,original.attemptedAt);assert.equal(p.capturedAt,original.completedAt);assert.equal(isSuccessfulPublishingGapTrial(args.trial,{source:'finacussolutions',now}),false)
 const attempt=buildPartialAttempt(p,{inserted:20,updated:0,deleted:0,expired:0,missed:0},now),updates=[];await recordPartialPublishingStatus({collection:()=>({updateOne:async(_q,u)=>{updates.push(u);return{matchedCount:1}}})},'finacussolutions',attempt)
 assert.equal(attempt.rawRecords,20);assert.equal(attempt.jobs,null);assert.equal(attempt.eligibleJobs,20);assert.equal(attempt.success,false);assert.equal(updates[0].$set.lastSuccess,false);assert.ok(Object.keys(updates[0].$set).every(k=>!k.startsWith('lastComplete')));for(const key of ['filteredEmptyDescription','filteredNonIndia','filteredInvalidUrl','filteredClosed','filteredNonJob','filteredOld'])assert.equal(attempt[key],null)
})
test('Finacus mutated fields, generic application identity, erased region, invented dates/totals or full source health cannot qualify',async()=>{
 const{verifyFinacusPartialPublishingTrial}=await load(),base=await makeTrial()
 for(const change of [t=>{t.source='other'},t=>{t.maxJobs=1},t=>{t.truncated=true},t=>{t.jobs.pop()},t=>{t.rawJobs=0},t=>{t.indiaJobs=20},t=>{t.globalTotal=20},t=>{t.jobs[0].jobId='fake'},t=>{t.jobs[0].title='Fake role'},t=>{t.jobs[0].city='Paris'},t=>{t.jobs[0].country='United States'},t=>{t.jobs[0].nativeApplicationPosition='Other role'},t=>{t.jobs[0].applicationUrlIsGeneric=false},t=>{t.jobs[0].applyUrl='https://example.com/apply'},t=>{t.jobs[0].jobDescription='Sample'},t=>{t.jobs[0].postingDate=t.completedAt},t=>{t.jobs[0].postedAt=t.completedAt},t=>{t.jobs[0].closingDate=t.completedAt},t=>{t.jobs[0].sourceListingComplete=true},t=>{t.jobs.find(j=>j.jobId==='602').nativeUnresolvedLocations=[]},t=>{t.nativeUnresolvedScopeEvidence=[]},t=>{t.nativeBoardEvidence.observedNativeCards=0},t=>{t.nativeBoardEvidence.completeIndiaTotal=20},t=>{t.companyScope.complete=true},t=>{t.companyScope.indiaTotal=20},t=>{t.detailHealth.complete=true},t=>{t.filterCounts.nonIndia=0},t=>{t.completedAt='2026-10-21T02:00:00Z'}]){const trial=structuredClone(base.trial);change(trial);await assert.rejects(verifyFinacusPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}),change.toString())}
})
for(const marker of ['success','extractionComplete'])test('Finacus explicit '+marker+' marker cannot relabel partial observation',async()=>{const{verifyFinacusPartialPublishingTrial}=await load(),base=await makeTrial(),trial=structuredClone(base.trial);trial[marker]=true;await assert.rejects(verifyFinacusPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}))})
test('Finacus stale, missing, duplicate, rehashed response/client/review/source/provider proof fails',async()=>{
 const{deriveFinacusPartialEvidence}=await load()
 for(const change of [f=>{f.httpEvidence.receipts.pop()},f=>{f.httpEvidence.receipts.push({...f.httpEvidence.receipts[0]})},f=>{f.now=new Date('2026-10-24T04:00:00Z')},f=>{f.httpEvidence.mode='generic-positive'},
 ...['independent-review','current-replay','code-attestation','capture-manifest','original-catalog-trial','current-code','current-dependency','current-catalog','current-provider','native'].map(kind=>f=>{const r=f.httpEvidence.receipts.find(r=>r.kind===kind);f.files.set(r.file,Buffer.from('{}'))}),
 f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='native'&&r.originFile==='006.json'),p=JSON.parse(f.files.get(r.file));p.body='Invented full JD';p.bodySha256=sha(p.body);const bytes=Buffer.from(JSON.stringify(p));f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes)},
 f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='current-code');const bytes=Buffer.from('// invented reviewed source');f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes)},
 ]){const f=fixture();change(f);await assert.rejects(deriveFinacusPartialEvidence(f))}
})
test('Finacus immutable freezer preserves20 exact original jobs/clocks and all26 responses, refuses reuse and escaped paths',async()=>{
 const url=runtime.url('scripts/freezeFinacusPartialPublishingTrial.js');assert.ok(fs.existsSync(url),'Finacus immutable freezer is required');const{freezeFinacusPartialTrial}=await import(url),parent=fs.mkdtempSync(path.join(os.tmpdir(),'finacus-proof-')),outputDirectory=path.join(parent,'release')
 try{const f=fixture(),result=await freezeFinacusPartialTrial({...f,outputDirectory}),bytes=fs.readFileSync(path.join(outputDirectory,'finacussolutions.json')),trial=JSON.parse(bytes),original=JSON.parse(f.files.get('evidence/frozen-trials/finacussolutions.json'));assert.equal(result.trialByteHash,sha(bytes));assert.equal(result.eligibleJobs,20);assert.equal(result.indiaJobs,null);assert.equal(result.missingDescriptions,0);assert.deepEqual(trial.jobs,original.jobs);assert.equal(trial.attemptedAt,original.attemptedAt);assert.equal(trial.completedAt,original.completedAt);for(const[file,body]of f.files)assert.deepEqual(fs.readFileSync(path.join(outputDirectory,file)),body);await assert.rejects(freezeFinacusPartialTrial({...f,outputDirectory}));const bad=fixture();bad.httpEvidence.receipts[0].file='../escape.json';const badOutput=path.join(parent,'bad');await assert.rejects(freezeFinacusPartialTrial({...bad,outputDirectory:badOutput}));assert.equal(fs.existsSync(badOutput),false)}finally{assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('finacus-proof-'));fs.rmSync(parent,{recursive:true})}
})

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import test,{after} from 'node:test'
import {createReviewedProofRuntime,readReviewedSnapshot} from './helpers/reviewedProofRuntime.js'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { buildPartialAttempt,recordPartialPublishingStatus } from '../scripts/partialPublishingGapEvidence.js'
import { isSuccessfulPublishingGapTrial } from '../scripts/publishPublishingGapRepairs.js'
const now=new Date('2026-10-20T23:50:00Z'),sha=b=>createHash('sha256').update(b).digest('hex'),url=new URL('../scripts/ivaluePartialPublishingEvidence.js',import.meta.url)
const load=async()=>{assert.ok(fs.existsSync(url),'iValue exact partial proof implementation is required');return import(runtime.url('scripts/ivaluePartialPublishingEvidence.js'))}
const fixture=()=>{const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/ivaluePartial/reviewed-native-001.json.gz',import.meta.url)))),files=new Map(Object.entries(f.files).map(([k,v])=>[k,Buffer.from(v,'base64')]));return{source:'ivalue',httpEvidence:f.httpEvidence,files,readEvidence:async file=>files.get(file),now}}
// Positive and mutation cases replay the immutable reviewed runtime.
const runtime=createReviewedProofRuntime(fixture(),{prefix:'ivalue-reviewed-proof-',extraFiles:new Map([['scraper-support/utils/publishableJobMetrics.js',readReviewedSnapshot(new URL('./fixtures/aeriesPartial/reviewed-publishableJobMetrics-7ebb487d0.js.gz',import.meta.url),'f7d4baf7d52d6f3efd0fe23e5adbfff820f53194f3a3ddfbe7a0982d385b0621')],['scraper/ivalue/fixtures/official-browser-binding-20261020.json',fixture().files.get(fixture().httpEvidence.receipts.find(r=>r.kind==='corporate-browser').file)]])})
after(runtime.cleanup)
test('ivalue verifier rejects changed reviewed source bytes and checkout drift',async()=>{
 const {deriveIValuePartialEvidence}=await import(url)
 const f=fixture(),drift=f.httpEvidence.receipts.filter(r=>r.sourcePath).some(r=>sha(fs.readFileSync(new URL('../'+r.sourcePath,import.meta.url)))!==r.sha256)
 if(drift)await assert.rejects(deriveIValuePartialEvidence(f),/current (?:source|extraction code).*differs/)
 else await assert.rejects(deriveIValuePartialEvidence(f),/current approved browser binding fixture differs|every selected role must remain eligible now/)
 const receipt=f.httpEvidence.receipts.find(r=>r.kind==='current-code'),file=runtime.url(receipt.sourcePath),bytes=fs.readFileSync(file)
 try {
  fs.writeFileSync(file,Buffer.concat([bytes,Buffer.from('\n// changed source bytes\n')]))
  const {deriveIValuePartialEvidence:deriveReviewed}=await load()
  await assert.rejects(deriveReviewed(f),/current source.*differs/)
 } finally {fs.writeFileSync(file,bytes)}
})

async function makeTrial(f=fixture()){
 const {deriveIValuePartialEvidence}=await load(),p=await deriveIValuePartialEvidence(f)
 const trial={schemaVersion:1,source:'ivalue',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence:f.httpEvidence,originalCapture:p.originalCapture,
  bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,nativeBoardEvidence:p.nativeBoardEvidence,nativeIdentityEvidence:p.nativeIdentityEvidence,companyScope:p.companyScope,
  detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,rawJobs:40,indiaJobs:38,globalTotal:null,observedSelectedIndia:37,jobs:p.jobs}
 return{trial,bytes:Buffer.from(JSON.stringify(trial)),readEvidence:f.readEvidence,now:f.now}
}
test('exact iValue proof accepts unchanged37 and separately records native40/India38/rejectedidentity1/missingJD0 with unknown company scope',async()=>{
 const{verifyIValuePartialPublishingTrial}=await load(),args=await makeTrial(),p=await verifyIValuePartialPublishingTrial(args)
 assert.equal(p.eligibleJobs,37);assert.equal(p.rawTotal,40);assert.equal(p.indiaTotal,38);assert.equal(p.publicTotal,39)
 assert.equal(p.nativeBoardEvidence.identityRejections,1);assert.equal(p.nativeBoardEvidence.missingDescriptions,0);assert.equal(p.nativeIdentityEvidence.rejectedNativeIdentities.length,1)
 assert.equal(p.nativeIdentityEvidence.rejectedNativeIdentities[0].reason,'ambiguous-public-url-resolves-to-another-native-identity')
 assert.equal(p.companyScope.globalTotal,null);assert.equal(p.companyScope.indiaTotal,null);assert.equal(p.companyScope.complete,false)
 assert.equal(p.detailHealth.complete,false);assert.equal(p.detailHealth.missingDescriptions,0);assert.equal(p.selectedDetailHealth.complete,true);assert.equal(p.inventoryEvidence.listingComplete,false)
 assert.ok(p.jobs.every(j=>j.sourceListingComplete===false&&j.sourceDetailComplete===true));assert.ok(Object.values(p.filterCounts).every(v=>v===null))
 const original=JSON.parse(await args.readEvidence('evidence/frozen-trials/ivalue.json'));assert.deepEqual(p.jobs,original.jobs);assert.equal(p.startedAt,original.attemptedAt);assert.equal(p.capturedAt,original.completedAt)
 assert.equal(p.replayEvidence.responsesUsed,46);assert.equal(isSuccessfulPublishingGapTrial(args.trial,{source:'ivalue',now}),false)
 const attempt=buildPartialAttempt(p,{inserted:37,updated:0,deleted:0,expired:0,missed:0},now),updates=[]
 await recordPartialPublishingStatus({collection:()=>({updateOne:async(q,u)=>{updates.push(u);return{matchedCount:1}}})},'ivalue',attempt)
 assert.equal(attempt.success,false);assert.equal(attempt.rawRecords,40);assert.equal(attempt.jobs,38);assert.equal(attempt.eligibleJobs,37);assert.equal(attempt.filteredEmptyDescription,null);assert.equal(Object.hasOwn(updates[0].$set,'lastCompleteCheckAt'),false)
})
test('iValue proof rejects changing counts, rejected identity grain, native fields, complete claims, date precision and source timestamps',async()=>{
 const{verifyIValuePartialPublishingTrial}=await load(),base=await makeTrial()
 for(const change of [t=>{t.source='other'},t=>{t.maxJobs=1},t=>{t.truncated=true},t=>{t.jobs.pop()},t=>{t.jobs.push(structuredClone(t.jobs[0]))},
  t=>{t.rawJobs=39},t=>{t.indiaJobs=37},t=>{t.globalTotal=40},t=>{t.nativeBoardEvidence.identityRejections=0},t=>{t.nativeBoardEvidence.missingDescriptions=1},
  t=>{t.nativeIdentityEvidence.rejectedNativeIdentities=[]},t=>{t.nativeIdentityEvidence.rejectedNativeIdentities[0].reason='missing-content'},t=>{t.companyScope.complete=true},t=>{t.companyScope.globalTotal=40},
  t=>{t.inventoryEvidence.listingComplete=true},t=>{t.detailHealth.complete=true},t=>{t.detailHealth.missingDescriptions=1},t=>{t.filterCounts.nonIndia=0},
  t=>{t.jobs[0].title='Fake'},t=>{t.jobs[0].country='US'},t=>{t.jobs[0].city='Paris'},t=>{t.jobs[0].jobId='fake'},t=>{t.jobs[0].requisitionId='1017'},t=>{t.jobs[0].applyUrl='https://example.com/fake'},
  t=>{t.jobs[0].jobDescription='See attachment'},t=>{t.jobs[0].sourceListingComplete=true},t=>{t.jobs[0].sourceClosingDateIsExact=!t.jobs[0].sourceClosingDateIsExact},t=>{t.completedAt='2026-10-20T23:49:00Z'},t=>{t.productionWrites=true},
 ]){const trial=structuredClone(base.trial);change(trial);await assert.rejects(verifyIValuePartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}),change.toString())}
})
test('missing, duplicate, stale, changed corporate/browser/code/native/root-review proof cannot qualify',async()=>{
 const{deriveIValuePartialEvidence}=await load()
 for(const change of [f=>{f.httpEvidence.receipts.pop()},f=>{f.httpEvidence.receipts.push({...f.httpEvidence.receipts[0]})},f=>{f.now=new Date('2026-10-23T23:50:00Z')},
 ...['corporate-browser','independent-review','independent-replay','corrected-replay','native-client','catalog-trial','current-code','native'].map(kind=>f=>{const r=f.httpEvidence.receipts.find(r=>r.kind===kind);f.files.set(r.file,Buffer.from('{}'))})
 ]){const f=fixture();change(f);await assert.rejects(deriveIValuePartialEvidence(f))}
})
test('caller-updated hashes cannot replace the blocked corporate page, public detail identity or historical/current source provenance',async()=>{
 const{deriveIValuePartialEvidence}=await load()
 for(const kind of ['corporate','detail','corrected-replay']){const f=fixture(),r=kind==='corrected-replay'?f.httpEvidence.receipts.find(r=>r.kind===kind):f.httpEvidence.receipts.filter(r=>r.kind==='native').find(r=>r.originFile===(kind==='corporate'?'001.json':'006.json')),p=JSON.parse(f.files.get(r.file))
  if(kind==='corporate')p.body='<a href="https://ivgroup.greythr.com/hire/jobs/">Invented active corporate handoff</a>'
  else if(kind==='detail')p.status=202
  else p.originalCaptureCodeHashes=p.currentSourceHashes
  const bytes=Buffer.from(JSON.stringify(p));f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes);await assert.rejects(deriveIValuePartialEvidence(f))
 }
})

test('iValue freezer preserves exact37 original job fields and evidence, original time windows, and immutable confined outputs',async()=>{
 const url=runtime.url('scripts/freezeIValuePartialPublishingTrial.js');assert.ok(fs.existsSync(url),'iValue exact immutable freezer is required')
 const{freezeIValuePartialTrial}=await import(url),parent=fs.mkdtempSync(path.join(os.tmpdir(),'ivalue-proof-')),outputDirectory=path.join(parent,'release')
 try{
  const f=fixture(),result=await freezeIValuePartialTrial({...f,outputDirectory}),bytes=fs.readFileSync(path.join(outputDirectory,'ivalue.json')),trial=JSON.parse(bytes)
  assert.equal(result.trialByteHash,sha(bytes));assert.equal(result.eligibleJobs,37);assert.equal(result.indiaJobs,38);assert.equal(result.identityRejections,1)
  const original=JSON.parse(f.files.get('evidence/frozen-trials/ivalue.json'));assert.deepEqual(trial.jobs,original.jobs);assert.equal(trial.attemptedAt,original.attemptedAt);assert.equal(trial.completedAt,original.completedAt)
  for(const[file,body]of f.files)assert.deepEqual(fs.readFileSync(path.join(outputDirectory,file)),body)
  await assert.rejects(freezeIValuePartialTrial({...f,outputDirectory}))
  const bad=fixture();bad.httpEvidence.receipts[0].file='../escape.json';const badOutput=path.join(parent,'bad');await assert.rejects(freezeIValuePartialTrial({...bad,outputDirectory:badOutput}));assert.equal(fs.existsSync(badOutput),false)
 }finally{assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('ivalue-proof-'));fs.rmSync(parent,{recursive:true})}
})

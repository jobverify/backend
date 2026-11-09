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
const now=new Date('2026-10-21T00:45:00Z'),sha=b=>createHash('sha256').update(b).digest('hex'),url=new URL('../scripts/eInfochipsPartialPublishingEvidence.js',import.meta.url)
const load=async()=>{assert.ok(fs.existsSync(url),'eInfochips exact partial proof implementation is required');return import(runtime.url('scripts/eInfochipsPartialPublishingEvidence.js'))}
const fixture=()=>{const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/eInfochipsPartial/reviewed-native-001.json.gz',import.meta.url)))),files=new Map(Object.entries(f.files).map(([k,v])=>[k,Buffer.from(v,'base64')]));return{source:'einfochips',httpEvidence:f.httpEvidence,files,readEvidence:async file=>files.get(file),now}}
// Positive and mutation cases replay the immutable reviewed runtime. The shared
// Workday engine is the actual Oct21 implementation from git7ebb487d0, before
// additional date/native-detail metadata changed the exact replayed job fields.
// The same commit preserves reviewed experience parsing and eligibility rules.
const runtime=createReviewedProofRuntime(fixture(),{prefix:'einfochips-reviewed-proof-',extraFiles:new Map([['scraper-support/detailExtractors/workday.js',readReviewedSnapshot(new URL('./fixtures/eInfochipsPartial/reviewed-workday-detail-7ebb487d0.js.gz',import.meta.url),'d5c832348c8edb433b79879e68f868fc7f68d23b3c1aeff37224a13360ca7205')],['scraper-support/utils/publishableJobMetrics.js',readReviewedSnapshot(new URL('./fixtures/aeriesPartial/reviewed-publishableJobMetrics-7ebb487d0.js.gz',import.meta.url),'f7d4baf7d52d6f3efd0fe23e5adbfff820f53194f3a3ddfbe7a0982d385b0621')],['src/utils/jobFilterSignals.js',readReviewedSnapshot(new URL('./fixtures/eInfochipsPartial/reviewed-jobFilterSignals-7ebb487d0.js.gz',import.meta.url),'2cce3c04654a68f27d654415e88186a0e7602cb261cd67c445491294893ee775')],['scraper-support/myworkday/engine.js',readReviewedSnapshot(new URL('./fixtures/eInfochipsPartial/reviewed-workday-engine-7ebb487d0.js.gz',import.meta.url),'986e83077e6da1d09d1bdb24ba024a9c993df40cd8afb9c328a16fcb0575b4ac')]])})
after(runtime.cleanup)
test('eInfochips verifier rejects changed reviewed source bytes and checkout drift',async()=>{
 const {deriveEInfochipsPartialEvidence}=await import(url)
 const f=fixture(),drift=f.httpEvidence.receipts.filter(r=>r.sourcePath).some(r=>sha(fs.readFileSync(new URL('../'+r.sourcePath,import.meta.url)))!==r.sha256)
 if(drift)await assert.rejects(deriveEInfochipsPartialEvidence(f),/current (?:source|extraction code).*differs/)
 else await assert.rejects(deriveEInfochipsPartialEvidence(f),/every current frozen native field and partial scope must remain unchanged/)
 const receipt=f.httpEvidence.receipts.find(r=>r.kind==='current-code'),file=runtime.url(receipt.sourcePath),bytes=fs.readFileSync(file)
 try {
  fs.writeFileSync(file,Buffer.concat([bytes,Buffer.from('\n// changed source bytes\n')]))
  const {deriveEInfochipsPartialEvidence:deriveReviewed}=await load()
  await assert.rejects(deriveReviewed(f),/current source.*differs/)
 } finally {fs.writeFileSync(file,bytes)}
})

async function makeTrial(f=fixture()){
 const{deriveEInfochipsPartialEvidence}=await load(),p=await deriveEInfochipsPartialEvidence(f)
 const trial={schemaVersion:1,source:'einfochips',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence:f.httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeMissingDescriptions:p.nativeMissingDescriptions,nativeLegalEmployerEvidence:p.nativeLegalEmployerEvidence,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,
  filterCounts:p.filterCounts,rawJobs:30,indiaJobs:null,globalTotal:null,observedSelectedIndia:25,jobs:p.jobs}
 return{trial,bytes:Buffer.from(JSON.stringify(trial)),readEvidence:f.readEvidence,now:f.now}
}

test('eInfochips proof publishes only25 unchanged healthy roles while native30/five empty descriptions/legal employer gaps retain incomplete company health',async()=>{
 const{verifyEInfochipsPartialPublishingTrial}=await load(),args=await makeTrial(),p=await verifyEInfochipsPartialPublishingTrial(args)
 assert.equal(p.eligibleJobs,25);assert.equal(p.rawTotal,30);assert.equal(p.indiaTotal,null);assert.equal(p.publicTotal,null)
 assert.equal(p.nativeBoardEvidence.observedIndiaKeywordRows,30);assert.equal(p.nativeMissingDescriptions.length,5);assert.equal(p.nativeLegalEmployerEvidence.rawUnknown,5);assert.equal(p.nativeLegalEmployerEvidence.selectedUnknown,2)
 assert.ok(p.jobs.every(j=>j.sourceListingComplete===false&&j.sourceDetailComplete===true));assert.equal(p.companyScope.complete,false);assert.equal(p.companyScope.globalTotal,null);assert.equal(p.companyScope.indiaTotal,null);assert.equal(p.companyScope.legalEntityCoverageComplete,false)
 assert.equal(p.detailHealth.complete,false);assert.equal(p.detailHealth.missingDescriptions,5);assert.equal(p.selectedDetailHealth.complete,true);assert.ok(Object.values(p.filterCounts).every(v=>v===null))
 const original=JSON.parse(await args.readEvidence('evidence/frozen-trials/einfochips.json'));assert.deepEqual(p.jobs,original.jobs.filter(j=>j.sourceDetailComplete===true));assert.equal(p.startedAt,original.attemptedAt);assert.equal(p.capturedAt,original.completedAt)
 assert.equal(p.originalCapture.captureTimeCodeHashes,null);assert.equal(p.originalCapture.corroboratedJobIdCorrections.length,6);assert.equal(p.replayEvidence.responsesUsed,68);assert.equal(isSuccessfulPublishingGapTrial(args.trial,{source:'einfochips',now}),false)
 const attempt=buildPartialAttempt(p,{inserted:25,updated:0,deleted:0,expired:0,missed:0},now),updates=[]
 await recordPartialPublishingStatus({collection:()=>({updateOne:async(_q,u)=>{updates.push(u);return{matchedCount:1}}})},'einfochips',attempt)
 assert.equal(attempt.rawRecords,30);assert.equal(attempt.jobs,null);assert.equal(attempt.eligibleJobs,25);assert.equal(attempt.success,false);assert.equal(attempt.detailHealth.complete,false);assert.equal(attempt.inventoryEvidence.listingComplete,false);assert.equal(updates[0].$set.lastSuccess,false);assert.ok(Object.keys(updates[0].$set).every(k=>!k.startsWith('lastComplete')))
 for(const key of ['filteredEmptyDescription','filteredNonIndia','filteredInvalidUrl','filteredClosed','filteredNonJob','filteredOld'])assert.equal(attempt[key],null)
})

test('eInfochips rejects mutated selected native jobs, partial counts, missing-description/legal grains, invented capture code or source completeness',async()=>{
 const{verifyEInfochipsPartialPublishingTrial}=await load(),base=await makeTrial()
 for(const change of [t=>{t.source='other'},t=>{t.maxJobs=1},t=>{t.truncated=true},t=>{t.jobs.pop()},t=>{t.rawJobs=25},t=>{t.indiaJobs=30},t=>{t.globalTotal=30},t=>{t.jobs[0].jobId='R000000'},t=>{t.jobs[0].requisitionId='R000000'},t=>{t.jobs[0].city='Paris'},t=>{t.jobs[0].jobDescription='Position and metadata'},t=>{t.jobs[0].nativeEmployer='Invented Limited'},t=>{t.jobs[0].sourceListingComplete=true},t=>{t.jobs[0].postingDate='2026-10-21T00:00:00Z'},
  t=>{t.nativeMissingDescriptions=[]},t=>{t.nativeLegalEmployerEvidence.rawUnknown=0},t=>{t.nativeLegalEmployerEvidence.selectedUnknown=0},t=>{t.companyScope.complete=true},t=>{t.companyScope.legalEntityCoverageComplete=true},t=>{t.detailHealth.missingDescriptions=0},t=>{t.filterCounts.emptyDescription=5},t=>{t.originalCapture.captureTimeCodeHashes=t.originalCapture.currentReviewedCode},t=>{t.completedAt='2026-10-21T00:40:00Z'},
 ]){const trial=structuredClone(base.trial);change(trial);await assert.rejects(verifyEInfochipsPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}),change.toString())}
})

test('eInfochips missing, duplicate, stale, substituted root/native/current-code evidence cannot qualify',async()=>{
 const{deriveEInfochipsPartialEvidence}=await load()
 for(const change of [f=>{f.httpEvidence.receipts.pop()},f=>{f.httpEvidence.receipts.push({...f.httpEvidence.receipts[0]})},f=>{f.now=new Date('2026-10-24T00:45:00Z')},
 ...['independent-review','independent-replay','corrected-replay','corrected-code-attestation','capture-manifest','catalog-trial','current-code','native'].map(kind=>f=>{const r=f.httpEvidence.receipts.find(r=>r.kind===kind);f.files.set(r.file,Buffer.from('{}'))})
 ]){const f=fixture();change(f);await assert.rejects(deriveEInfochipsPartialEvidence(f))}
})

test('updating caller hashes cannot relabel actual eInfochips empty descriptions or replace country, handoff, root review or native paging proof',async()=>{
 const{deriveEInfochipsPartialEvidence}=await load()
 for(const kind of ['handoff','native-page','empty-description','root-review']){const f=fixture(),r=kind==='root-review'?f.httpEvidence.receipts.find(r=>r.kind==='independent-review'):f.httpEvidence.receipts.filter(r=>r.kind==='native').find(r=>r.originFile===(kind==='handoff'?'001.json':kind==='native-page'?'005.json':'006.json')),p=JSON.parse(f.files.get(r.file))
  if(kind==='handoff')p.body='<a href="https://example.com/jobs">Invented employer</a>'
  else if(kind==='native-page'){const v=JSON.parse(p.body);v.jobPostings=[];p.body=JSON.stringify(v);p.bodySha256=sha(p.body)}
  else if(kind==='empty-description')p.status=202
  else p.blankNativeLegalEmployers=0
  const bytes=Buffer.from(JSON.stringify(p));f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes);await assert.rejects(deriveEInfochipsPartialEvidence(f))
 }
})

test('eInfochips freezer preserves exactly25 original healthy jobs and all68 receipts in an unused confined directory',async()=>{
 const url=runtime.url('scripts/freezeEInfochipsPartialPublishingTrial.js');assert.ok(fs.existsSync(url),'eInfochips immutable freezer is required')
 const{freezeEInfochipsPartialTrial}=await import(url),parent=fs.mkdtempSync(path.join(os.tmpdir(),'einfochips-proof-')),outputDirectory=path.join(parent,'release')
 try{
  const f=fixture(),result=await freezeEInfochipsPartialTrial({...f,outputDirectory}),bytes=fs.readFileSync(path.join(outputDirectory,'einfochips.json')),trial=JSON.parse(bytes),original=JSON.parse(f.files.get('evidence/frozen-trials/einfochips.json'))
  assert.equal(result.trialByteHash,sha(bytes));assert.equal(result.eligibleJobs,25);assert.equal(result.indiaJobs,null);assert.equal(result.missingDescriptions,5);assert.equal(result.selectedBlankNativeLegalEmployers,2)
  assert.deepEqual(trial.jobs,original.jobs.filter(j=>j.sourceDetailComplete===true));assert.equal(trial.attemptedAt,original.attemptedAt);assert.equal(trial.completedAt,original.completedAt)
  for(const[file,body]of f.files)assert.deepEqual(fs.readFileSync(path.join(outputDirectory,file)),body)
  await assert.rejects(freezeEInfochipsPartialTrial({...f,outputDirectory}))
  const bad=fixture();bad.httpEvidence.receipts[0].file='../escape.json';const badOutput=path.join(parent,'bad');await assert.rejects(freezeEInfochipsPartialTrial({...bad,outputDirectory:badOutput}));assert.equal(fs.existsSync(badOutput),false)
 }finally{assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('einfochips-proof-'));fs.rmSync(parent,{recursive:true})}
})

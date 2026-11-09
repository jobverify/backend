import assert from'node:assert/strict'
import fs from'node:fs'
import path from'node:path'
import os from'node:os'
import{fileURLToPath,pathToFileURL}from'node:url'
import test,{after} from'node:test'
import{gunzipSync}from'node:zlib'
import{createHash}from'node:crypto'
import{buildPartialAttempt}from'../scripts/partialPublishingGapEvidence.js'
import{isSuccessfulPublishingGapTrial}from'../scripts/publishPublishingGapRepairs.js'
const now=new Date('2026-10-21T04:00:00Z'),hash=x=>createHash('sha256').update(x).digest('hex')
const fixture=(source='blackrock',historical=false)=>{
 const raw=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/workdayPartial/'+source+(historical?'-reviewed-004':'-current-code-rereview-002')+'.json.gz',import.meta.url)))),files=new Map(Object.entries(raw.files).map(([key,value])=>[key,Buffer.from(value,'base64')]))
 return {source,httpEvidence:raw.httpEvidence,files,readEvidence:async file=>files.get(file),now}
}
// Historical positives run against every exact source/config/dependency byte
// attested by their immutable review. Current production code keeps its strict
// source-drift gate and is tested separately below.
const backend=fileURLToPath(new URL('..',import.meta.url)),reviewedRoot=fs.mkdtempSync(path.join(os.tmpdir(),'workday-reviewed-code-')),reviewedBackend=path.join(reviewedRoot,'jobverify-backend')
fs.mkdirSync(reviewedBackend)
fs.writeFileSync(path.join(reviewedBackend,'package.json'),'{"type":"module"}')
const copyRuntimeDirectory=relative=>{
 const target=path.join(reviewedBackend,relative);fs.mkdirSync(target,{recursive:true})
 for(const entry of fs.readdirSync(path.join(backend,relative),{withFileTypes:true}))if(entry.isFile()&&/\.(?:js|json)$/.test(entry.name))fs.copyFileSync(path.join(backend,relative,entry.name),path.join(target,entry.name))
}
for(const relative of ['scraper-support','scraper-support/utils','scraper-support/myworkday','scraper-support/shared','scraper-support/detailExtractors','scraper-support/providers','scraper-support/apiPortal','src/utils','src/constants'])copyRuntimeDirectory(relative)
// The current registry wrapper imports these source-owned catalog constants.
// Supply its runtime dependencies separately from the exact historical source
// and policy bytes restored and hash-verified below.
for(const source of ['finolexindustrieslimited','goodnotes','dentalkart','dhan']){
 const relative=path.join('scraper',source,'catalog.js'),target=path.join(reviewedBackend,relative)
 fs.mkdirSync(path.dirname(target),{recursive:true})
 fs.copyFileSync(path.join(backend,relative),target)
}
fs.mkdirSync(path.join(reviewedBackend,'scripts'))
const localProofs=new Set(['partialPublishingGapEvidence.js','workdayPartialPublishingEvidence.js','workdayPartialRereviewEvidence.js','freezeWorkdayPartialRereviewTrial.js'])
for(const entry of fs.readdirSync(path.join(backend,'scripts'),{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.js')){
 const target=path.join(reviewedBackend,'scripts',entry.name),original=path.join(backend,'scripts',entry.name)
 if(localProofs.has(entry.name))fs.copyFileSync(original,target)
 else fs.writeFileSync(target,'export * from '+JSON.stringify(pathToFileURL(original).href)+';')
}
const restoredHashes=new Map()
for(const source of ['blackrock','blackstone']){
 const f=fixture(source)
 for(const receipt of f.httpEvidence.receipts.filter(r=>r.kind==='current-code')){
  const bytes=f.files.get(receipt.file),target=path.resolve(reviewedRoot,receipt.sourcePath),relative=path.relative(reviewedBackend,target)
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Reviewed runtime must stay inside its temporary backend')
  assert.equal(hash(bytes),receipt.sha256)
  if(restoredHashes.has(receipt.sourcePath))assert.equal(restoredHashes.get(receipt.sourcePath),receipt.sha256)
  restoredHashes.set(receipt.sourcePath,receipt.sha256)
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes)
  assert.equal(hash(fs.readFileSync(target)),receipt.sha256)
 }
}
// Exact scraper-support/utils/publishableJobMetrics.js from historical commit
// 7ebb487d0a22e53f3a5a3967e9a32cb5e921c812: the reviewed capture predates the
// later one-calendar-month publication cutoff. Keep archived clocks/jobs and
// that historical policy together; production continues using today's policy.
const historicalMetrics=gunzipSync(fs.readFileSync(new URL('./fixtures/workdayPartial/reviewed-publishableJobMetrics.js.gz',import.meta.url)))
assert.equal(hash(historicalMetrics),'f7d4baf7d52d6f3efd0fe23e5adbfff820f53194f3a3ddfbe7a0982d385b0621')
fs.writeFileSync(path.join(reviewedBackend,'scraper-support/utils/publishableJobMetrics.js'),historicalMetrics)
const dependencyLink=path.join(reviewedBackend,'node_modules');fs.symlinkSync(path.join(backend,'node_modules'),dependencyLink,'junction')
after(()=>{
 assert.equal(path.dirname(reviewedRoot),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(reviewedRoot).startsWith('workday-reviewed-code-'))
 assert.ok(fs.lstatSync(dependencyLink).isSymbolicLink());fs.unlinkSync(dependencyLink)
 fs.rmSync(reviewedRoot,{recursive:true})
})
const reviewedModule=name=>import(pathToFileURL(path.join(reviewedBackend,'scripts',name)))
const{verifyPartialPublishingTrial}=await reviewedModule('partialPublishingGapEvidence.js')
async function trialFor(f){
 const {deriveWorkdayPartialEvidence}=await reviewedModule('workdayPartialPublishingEvidence.js')
 const proof=await deriveWorkdayPartialEvidence(f)
 const trial={schemaVersion:1,source:f.source,mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:proof.startedAt,completedAt:proof.capturedAt,httpEvidence:f.httpEvidence,originalCapture:proof.originalCapture,
  inventoryEvidence:proof.inventoryEvidence,bindingEvidence:proof.bindingEvidence,detailHealth:proof.detailHealth,selectedDetailHealth:proof.selectedDetailHealth,
  filterCounts:proof.filterCounts,codeRereview:proof.codeRereview,rawJobs:null,indiaJobs:null,globalTotal:null,observedSelectedIndia:proof.jobs.length,jobs:proof.jobs}
 return {trial,bytes:Buffer.from(JSON.stringify(trial)),readEvidence:f.readEvidence,now}
}
for(const[source,count]of[['blackrock',42],['blackstone',4]])test('exact independently reviewed '+source+' partial capture accepts only its '+count+' healthy selected native India roles',async()=>{
 const args=await trialFor(fixture(source)),proof=await verifyPartialPublishingTrial(args)
 assert.equal(proof.eligibleJobs,count)
 assert.equal(proof.rawTotal,null);assert.equal(proof.publicTotal,null);assert.equal(proof.indiaTotal,null)
 assert.equal(proof.detailHealth.complete,false);assert.equal(proof.selectedDetailHealth.complete,true)
 assert.equal(proof.trial.inventoryEvidence.listingComplete,false)
 assert.ok(proof.trial.jobs.every(j=>j.sourceListingComplete===false&&j.sourceDetailComplete===true&&j.sourceGlobalJobCount===null))
 assert.equal(isSuccessfulPublishingGapTrial(args.trial,{source,now}),false)
 const attempt=buildPartialAttempt(proof,{inserted:count,updated:0,deleted:0,expired:0,missed:0},now)
 assert.equal(attempt.success,false);assert.equal(attempt.rawRecords,null);assert.equal(attempt.jobs,null);assert.equal(attempt.eligibleJobs,count)
 assert.equal(attempt.detailHealth.complete,false)
})

test('partial Workday dispatcher rejects complete, wrong source, truncation, false counts, content, native identity and date precision mutations',async()=>{
 const base=await trialFor(fixture())
 for(const mutate of [
  t=>{t.source='blueorigin'},t=>{t.source='blackberry'},t=>{t.jobs=[]},t=>{t.jobs.pop()},t=>{t.maxJobs=1},t=>{t.truncated=true},
  t=>{t.rawJobs=42},t=>{t.indiaJobs=42},t=>{t.globalTotal=286},t=>{t.inventoryEvidence.listingComplete=true},t=>{t.inventoryEvidence.reportedTotal=42},
  t=>{t.detailHealth.complete=true},t=>{t.selectedDetailHealth.complete=false},t=>{t.jobs[0].sourceListingComplete=true},t=>{t.jobs[0].sourceDetailComplete=false},
  t=>{t.jobs[0].title='Invented title'},t=>{t.jobs[0].country='US'},t=>{t.jobs[0].nativeEmployer='Invented employer'},
  t=>{t.jobs[0].sourceDescription='<p>Invented JD</p>'},t=>{t.jobs[0].applyUrl='https://example.com/fake'},t=>{t.jobs[0].sourceClosingDateIsExact=true},
  t=>{t.completedAt='2026-10-20T22:59:59Z'},t=>{t.productionWrites=true},t=>{t.filterCounts.nonIndia=0},
 ]){const trial=structuredClone(base.trial);mutate(trial);await assert.rejects(verifyPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}))}
})

test('missing, duplicate, mismatched, stale, unreviewed or changed raw native evidence cannot qualify',async()=>{
 const {deriveWorkdayPartialEvidence}=await reviewedModule('workdayPartialPublishingEvidence.js')
 for(const mutate of [
  f=>{f.httpEvidence.receipts.pop()},f=>{f.httpEvidence.receipts.push({...f.httpEvidence.receipts[0]})},
  ...['capture-manifest.json','capture-trial.json','independent-review.json','discovery.json'].map(name=>f=>{const r=f.httpEvidence.receipts.find(r=>r.originalFile==='evidence/'+name);f.files.set(r.file,Buffer.from('{}'))}),
  f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='original-proof');f.files.set(r.file,Buffer.from('changed'))},
  f=>{f.httpEvidence.receipts=f.httpEvidence.receipts.filter(r=>!r.originalFile?.startsWith('evidence/discovery/proof/'))},
  f=>{f.httpEvidence.receipts=f.httpEvidence.receipts.filter(r=>r.kind!=='current-code')},
  f=>{f.now=new Date('2026-10-23T23:00:00Z')},
 ]){const f=fixture();mutate(f);await assert.rejects(deriveWorkdayPartialEvidence(f),mutate.toString())}
})

test('changing approved native packet fields and updating caller receipt hashes still fails immutable reviewed capture binding',async()=>{
 const {deriveWorkdayPartialEvidence}=await reviewedModule('workdayPartialPublishingEvidence.js')
 for(const field of ['status','url','body']){const f=fixture(),old=JSON.parse(f.files.get('evidence/original-partial-trial.json')),native=old.httpEvidence.receipts.find(r=>r.kind==='native'),r=f.httpEvidence.receipts.find(r=>r.originalFile===native.file),p=JSON.parse(f.files.get(r.file));p[field]=field==='status'?202:field==='url'?'https://example.com/wrong':'invented native response';const bytes=Buffer.from(JSON.stringify(p));f.files.set(r.file,bytes);Object.assign(r,{bytes:bytes.length,sha256:hash(bytes)});await assert.rejects(deriveWorkdayPartialEvidence(f))}
})

test('historical004 contracts remain fail-closed after shared hardening; relabelling old proof cannot become rereview002',async()=>{
 const{deriveWorkdayPartialEvidence}=await import('../scripts/workdayPartialPublishingEvidence.js')
 for(const source of ['blackrock','blackstone']){const old=fixture(source,true);await assert.rejects(deriveWorkdayPartialEvidence(old),/current extraction\/config code differs/);old.httpEvidence.mode='reviewed-workday-partial-current-code-rereview-002';await assert.rejects(deriveWorkdayPartialEvidence(old))}
})

test('new current-code review, every added dependency and unchanged historical trial bytes are mandatory',async()=>{
 const{deriveWorkdayPartialEvidence}=await reviewedModule('workdayPartialPublishingEvidence.js')
 for(const kind of ['original-partial-trial','current-code-review','historical-gate-review','historical-release','current-code']){const f=fixture(),r=f.httpEvidence.receipts.find(r=>r.kind===kind),b=Buffer.from('{}');f.files.set(r.file,b);r.bytes=b.length;r.sha256=hash(b);await assert.rejects(deriveWorkdayPartialEvidence(f))}
 const f=fixture();f.httpEvidence.receipts=f.httpEvidence.receipts.filter(r=>!r.sourcePath?.endsWith('/activeNativeHtml.js'));await assert.rejects(deriveWorkdayPartialEvidence(f))
})

test('new Workday version retains null counts and original clocks and rejects success/full-extraction/provenance inventions',async()=>{
 const base=await trialFor(fixture())
 for(const change of [t=>{t.success=true},t=>{t.extractionComplete=true},t=>{delete t.codeRereview},t=>{t.codeRereview.originalCaptureCodeReplaced=true},t=>{t.codeRereview.reviewedAt=t.completedAt},t=>{t.httpEvidence.mode='reviewed-workday-partial-exact-native-capture'}]){const trial=structuredClone(base.trial);change(trial);await assert.rejects(verifyPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}))}
 const original=JSON.parse(await base.readEvidence('evidence/original-partial-trial.json'));assert.deepEqual(base.trial.jobs,original.jobs);assert.equal(base.trial.attemptedAt,original.attemptedAt);assert.equal(base.trial.completedAt,original.completedAt)
})

test('current-code Workday freezer preserves all original proof bytes and refuses replacement or escaped output',async()=>{
 const url=pathToFileURL(path.join(reviewedBackend,'scripts/freezeWorkdayPartialRereviewTrial.js'));assert.ok(fs.existsSync(url),'Versioned Workday freezer required');const{freezeWorkdayPartialRereviewTrial}=await import(url),parent=fs.mkdtempSync(path.join(os.tmpdir(),'workday-rereview-')),outputDirectory=path.join(parent,'release')
 try{const f=fixture('blackstone'),r=await freezeWorkdayPartialRereviewTrial({...f,outputDirectory}),bytes=fs.readFileSync(path.join(outputDirectory,'blackstone.json')),trial=JSON.parse(bytes),old=JSON.parse(f.files.get('evidence/original-partial-trial.json'));assert.equal(r.trialByteHash,hash(bytes));assert.equal(r.eligibleJobs,4);assert.equal(r.rawJobs,null);assert.equal(r.indiaJobs,null);assert.deepEqual(trial.jobs,old.jobs);assert.equal(trial.attemptedAt,old.attemptedAt);assert.equal(trial.completedAt,old.completedAt);for(const[file,body]of f.files)assert.deepEqual(fs.readFileSync(path.join(outputDirectory,file)),body);await assert.rejects(freezeWorkdayPartialRereviewTrial({...f,outputDirectory}));const bad=fixture('blackstone');bad.httpEvidence.receipts[0].file='../escape.json';const badOutput=path.join(parent,'bad');await assert.rejects(freezeWorkdayPartialRereviewTrial({...bad,outputDirectory:badOutput}));assert.equal(fs.existsSync(badOutput),false)}finally{assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('workday-rereview-'));fs.rmSync(parent,{recursive:true})}
})

test('current Workday derive and dispatcher reject both historical rereview002 proofs after engine source drift',async()=>{
 const {deriveWorkdayPartialEvidence}=await import('../scripts/workdayPartialPublishingEvidence.js'),{verifyPartialPublishingTrial:verifyCurrent}=await import('../scripts/partialPublishingGapEvidence.js')
 for(const source of ['blackrock','blackstone']){
  const f=fixture(source),args=await trialFor(f)
  await assert.rejects(deriveWorkdayPartialEvidence(f),/current source\/config\/dependency differs from independent rereview/)
  await assert.rejects(verifyCurrent(args),/current source\/config\/dependency differs from independent rereview/)
 }
})

test('historical Workday022 report facts survive current code drift and staleness without publication qualification or new gate reads',async t=>{
 const{readOrCreatePartialReportAudit}=await import('../scripts/partialPublishingReportFacts.js')
 for(const source of ['blackrock','blackstone']){
  const f=fixture(source),historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/workdayPartial/'+source+'-historical-report-cache-022.json.gz',import.meta.url)))),parent=fs.mkdtempSync(path.join(os.tmpdir(),'workday-history-')),trialDir=path.join(parent,'trial'),cacheDirectory=path.join(parent,'cache');fs.mkdirSync(trialDir);fs.mkdirSync(cacheDirectory)
  try{const bytes=f.files.get('evidence/original-partial-trial.json'),trial=JSON.parse(bytes),trialFile=path.join(trialDir,source+'.json');fs.writeFileSync(trialFile,bytes);for(const r of trial.httpEvidence.receipts){const dest=path.join(trialDir,r.file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,f.files.get(f.httpEvidence.receipts.find(p=>p.originalFile===r.file).file))}for(const[file,body]of Object.entries(historical.files))fs.writeFileSync(path.join(cacheDirectory,file),Buffer.from(body,'base64'))
   const target=fileURLToPath(new URL('../scraper-support/shared/workdayBoardUnion.js',import.meta.url)),read=fs.readFileSync;let currentCodeReads=0;t.mock.method(fs,'readFileSync',(file,...args)=>{if(typeof file==='string'&&path.resolve(file)===target){currentCodeReads++;throw Error('Historical report must not read current shared code')}return read(file,...args)})
   const audit=await readOrCreatePartialReportAudit({source,trialFile,artifact:historical.artifact,expectedTrialByteHash:historical.trialByteHash,cacheDirectory,now:new Date('2026-10-24T04:00:00Z')});t.mock.restoreAll();assert.equal(currentCodeReads,0);assert.equal(audit.eligibleJobs,source==='blackrock'?42:4);assert.equal(audit.rawJobs,null);assert.equal(audit.indiaJobs,null);assert.equal(audit.detailHealth.complete,false);assert.equal(audit.inventoryEvidence.listingComplete,false);assert.equal(audit.completedAt,trial.completedAt);assert.equal(audit.supportingEvidence.at(-1).publicationQualification,false);assert.deepEqual(fs.readdirSync(cacheDirectory).sort(),Object.keys(historical.files).sort())
  }finally{t.mock.restoreAll();assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('workday-history-'));fs.rmSync(parent,{recursive:true})}
 }
})

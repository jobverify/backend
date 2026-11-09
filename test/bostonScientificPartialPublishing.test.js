import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import test,{after} from 'node:test'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {buildPartialAttempt,recordPartialPublishingStatus} from '../scripts/partialPublishingGapEvidence.js'
import {isSuccessfulPublishingGapTrial} from '../scripts/publishPublishingGapRepairs.js'
const now=new Date('2026-10-21T00:35:00Z'),sha=b=>createHash('sha256').update(b).digest('hex'),url=new URL('../scripts/bostonScientificPartialPublishingEvidence.js',import.meta.url)
const load=async()=>{assert.ok(fs.existsSync(url),'Boston Scientific exact partial proof implementation is required');return import(pathToFileURL(path.join(reviewedRoot,'scripts/bostonScientificPartialPublishingEvidence.js')))}
const fixture=(version='002')=>{const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/bostonScientificPartial/reviewed-native-'+version+'.json.gz',import.meta.url)))),files=new Map(Object.entries(f.files).map(([k,v])=>[k,Buffer.from(v,'base64')]));return{source:'bostonscientific',httpEvidence:f.httpEvidence,files,readEvidence:async file=>files.get(file),now}}
// Positive historical proofs require their exact reviewed runtime, while the
// production verifier must continue rejecting those proofs after source drift.
// Restore the attested source and provider files in a disposable offline tree;
// the immutable receipt bundle and the live checkout are never rewritten.
const backendRoot=fileURLToPath(new URL('..',import.meta.url)),reviewedRoot=fs.mkdtempSync(path.join(os.tmpdir(),'boston-reviewed-code-')),junctions=[]
fs.mkdirSync(path.join(reviewedRoot,'scripts'));fs.mkdirSync(path.join(reviewedRoot,'scraper/bostonscientific'),{recursive:true});fs.mkdirSync(path.join(reviewedRoot,'scraper-support/providers'),{recursive:true})
fs.writeFileSync(path.join(reviewedRoot,'package.json'),'{"type":"module"}')
for(const name of ['bostonScientificPartialPublishingEvidence.js','freezeBostonScientificPartialPublishingTrial.js','officialRecruitmentLinks.js']){
 fs.copyFileSync(path.join(backendRoot,'scripts',name),path.join(reviewedRoot,'scripts',name))
}
for(const name of ['src','scraper-support/utils','scraper-support/apiPortal']){
 const link=path.join(reviewedRoot,name);fs.symlinkSync(path.join(backendRoot,name),link,'junction');junctions.push(link)
}
for(const name of ['scripts/partialPublishingGapEvidence.js','scraper-support/providers/index.js']){
 fs.writeFileSync(path.join(reviewedRoot,name),'export * from '+JSON.stringify(pathToFileURL(path.join(backendRoot,name)).href)+';')
}
// Unchanged bytes archived with the reviewed October21 runtime. Its Eightfold
// template predates the later sort_by default, which changes receipt URLs.
const reviewedTemplate=gunzipSync(fs.readFileSync(new URL('./fixtures/bostonScientificPartial/reviewed-apiPortalTemplates.js.gz',import.meta.url)))
assert.equal(sha(reviewedTemplate),'2e6634a4a09f96cc27dcf89d0ec3a7b019ba418c3ad2971fc02dc8174304f16c')
fs.writeFileSync(path.join(reviewedRoot,'scraper-support/providers/apiPortalTemplates.js'),reviewedTemplate)
const reviewed=fixture()
for(const receipt of reviewed.httpEvidence.receipts.filter(r=>r.kind==='current-code')){
 assert.ok(['scraper/bostonscientific/script.js','scraper/bostonscientific/nativeContract.js','scraper/bostonscientific/nativeContent.js'].includes(receipt.sourcePath))
 fs.writeFileSync(path.join(reviewedRoot,receipt.sourcePath),reviewed.files.get(receipt.file))
}
// The complete reviewed historical closure includes this exact provider file.
// Current production metadata/source checks remain untouched and fail closed.
const providerReceipts=reviewed.httpEvidence.receipts.filter(r=>r.kind==='provider-extension')
assert.equal(providerReceipts.length,1)
for(const receipt of providerReceipts){
 assert.equal(receipt.sourcePath,'scraper-support/providers/providerExtensions/zzzzzzzzzzzzzzzzzzz-verified-discovery-adapters-014.json')
 const bytes=reviewed.files.get(receipt.file);assert.equal(sha(bytes),receipt.sha256)
 const destination=path.join(reviewedRoot,receipt.sourcePath);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes)
}
after(()=>{
 assert.equal(path.dirname(reviewedRoot),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(reviewedRoot).startsWith('boston-reviewed-code-'))
 for(const link of junctions)fs.unlinkSync(link)
 fs.rmSync(reviewedRoot,{recursive:true})
})
async function makeTrial(f=fixture()){
 const{deriveBostonScientificPartialEvidence}=await load(),p=await deriveBostonScientificPartialEvidence(f)
 const trial={schemaVersion:1,source:'bostonscientific',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence:f.httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeIdentityEvidence:p.nativeIdentityEvidence,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,
  filterCounts:p.filterCounts,rawJobs:500,indiaJobs:null,globalTotal:null,observedSelectedIndia:4,jobs:p.jobs}
 return{trial,bytes:Buffer.from(JSON.stringify(trial)),readEvidence:f.readEvidence,now:f.now}
}

test('exact Boston Scientific partial proof accepts only four unchanged roles while observed500, country facet4, seven unknown scopes and possible search ceiling stay separate',async()=>{
 const{verifyBostonScientificPartialPublishingTrial}=await load(),args=await makeTrial(),p=await verifyBostonScientificPartialPublishingTrial(args)
 assert.equal(p.eligibleJobs,4);assert.equal(p.rawTotal,500);assert.equal(p.indiaTotal,null);assert.equal(p.publicTotal,null)
 assert.equal(p.nativeBoardEvidence.reportedSearchCount,500);assert.equal(p.nativeBoardEvidence.uniqueObservedIDs,500);assert.equal(p.nativeBoardEvidence.knownIndiaCountryFacet,4);assert.equal(p.nativeBoardEvidence.unresolvedGeographyRows,7);assert.equal(p.nativeBoardEvidence.searchCeilingUnresolved,true)
 assert.equal(p.nativeIdentityEvidence.unresolvedScopes.length,7);assert.equal(p.companyScope.complete,false);assert.equal(p.companyScope.globalTotal,null);assert.equal(p.companyScope.indiaTotal,null)
 assert.equal(p.detailHealth.complete,false);assert.equal(p.detailHealth.missingDescriptions,0);assert.equal(p.selectedDetailHealth.complete,true);assert.equal(p.inventoryEvidence.listingComplete,false)
 assert.ok(p.jobs.every(j=>j.sourceListingComplete===false&&j.sourceDetailComplete===true));assert.ok(Object.values(p.filterCounts).every(v=>v===null))
 const original=JSON.parse(await args.readEvidence('evidence/frozen-trials/bostonscientific.json'));assert.deepEqual(p.jobs,original.jobs);assert.equal(p.startedAt,original.attemptedAt);assert.equal(p.capturedAt,original.completedAt)
 assert.equal(p.replayEvidence.responsesUsed,60);assert.equal(isSuccessfulPublishingGapTrial(args.trial,{source:'bostonscientific',now}),false)
 const attempt=buildPartialAttempt(p,{inserted:4,updated:0,deleted:0,expired:0,missed:0},now),updates=[]
 await recordPartialPublishingStatus({collection:()=>({updateOne:async(q,u)=>{updates.push(u);return{matchedCount:1}}})},'bostonscientific',attempt)
 assert.equal(attempt.success,false);assert.equal(attempt.rawRecords,500);assert.equal(attempt.jobs,null);assert.equal(attempt.eligibleJobs,4)
 for(const key of ['filteredEmptyDescription','filteredNonIndia','filteredInvalidUrl','filteredClosed','filteredNonJob','filteredOld'])assert.equal(attempt[key],null)
 assert.equal(attempt.inventoryEvidence.listingComplete,false);assert.equal(attempt.detailHealth.complete,false);assert.equal(updates[0].$set.lastSuccess,false);assert.ok(Object.keys(updates[0].$set).every(k=>!k.startsWith('lastComplete')))
})

test('Boston proof rejects changed counts, whole-company or complete claims, missing unknowns and changes to any selected native field',async()=>{
 const{verifyBostonScientificPartialPublishingTrial}=await load(),base=await makeTrial()
 for(const change of [t=>{t.source='other'},t=>{t.maxJobs=1},t=>{t.truncated=true},t=>{t.jobs.pop()},t=>{t.jobs.push(structuredClone(t.jobs[0]))},t=>{t.rawJobs=499},t=>{t.indiaJobs=4},t=>{t.globalTotal=500},
  t=>{t.nativeBoardEvidence.reportedSearchCount=0},t=>{t.nativeBoardEvidence.knownIndiaCountryFacet=0},t=>{t.nativeBoardEvidence.unresolvedGeographyRows=0},t=>{t.nativeBoardEvidence.searchCeilingUnresolved=false},t=>{t.nativeIdentityEvidence.unresolvedScopes=[]},
  t=>{t.companyScope.complete=true},t=>{t.companyScope.globalTotal=500},t=>{t.companyScope.indiaTotal=4},t=>{t.inventoryEvidence.listingComplete=true},t=>{t.detailHealth.complete=true},t=>{t.filterCounts.nonIndia=496},
  t=>{t.jobs[0].title='Fake'},t=>{t.jobs[0].country='US'},t=>{t.jobs[0].city='Paris'},t=>{t.jobs[0].jobId=123},t=>{t.jobs[0].requisitionId='FAKE'},t=>{t.jobs[0].applyUrl='https://example.com/fake'},
  t=>{t.jobs[0].jobDescription='See attachment'},t=>{t.jobs[0].sourceListingComplete=true},t=>{t.jobs[0].postingDate='2026-10-21T00:00:00Z'},t=>{t.jobs[0].sourceNativeStandardizedLocations=['Paris, FR']},t=>{t.completedAt='2026-10-21T00:09:00Z'},t=>{t.productionWrites=true},
 ]){const trial=structuredClone(base.trial);change(trial);await assert.rejects(verifyBostonScientificPartialPublishingTrial({...base,trial,bytes:Buffer.from(JSON.stringify(trial))}),change.toString())}
})

test('missing, duplicate, stale or altered Boston corporate/native/current-code/independent-review evidence cannot qualify',async()=>{
 const{deriveBostonScientificPartialEvidence}=await load()
 for(const change of [f=>{f.httpEvidence.receipts.pop()},f=>{f.httpEvidence.receipts.push({...f.httpEvidence.receipts[0]})},f=>{f.now=new Date('2026-10-24T00:10:00Z')},
 ...['official-proof','independent-review','independent-replay','corrected-replay','catalog-trial','current-code','native','provider-extension'].map(kind=>f=>{const r=f.httpEvidence.receipts.find(r=>r.kind===kind);f.files.set(r.file,Buffer.from('{}'))})
 ]){const f=fixture();change(f);await assert.rejects(deriveBostonScientificPartialEvidence(f))}
})

test('caller-updated hashes cannot replace actual Boston paging, detail, official handoff or historical/current source provenance',async()=>{
 const{deriveBostonScientificPartialEvidence}=await load()
 for(const kind of ['corporate','page','detail','corrected-replay']){const f=fixture(),r=kind==='corrected-replay'?f.httpEvidence.receipts.find(r=>r.kind===kind):f.httpEvidence.receipts.filter(r=>r.kind==='native').find(r=>r.originFile===(kind==='corporate'?'001.json':kind==='page'?'003.json':'055.json')),p=JSON.parse(f.files.get(r.file))
  if(kind==='corporate')p.body='<a href="https://example.com/careers">Other company</a>'
  else if(kind==='page'){const payload=JSON.parse(p.body);payload.data.count=499;p.body=JSON.stringify(payload);p.bodySha256=sha(p.body)}
  else if(kind==='detail')p.status=202
  else p.captureTimeSourceHashes=p.currentSourceHashes
  const bytes=Buffer.from(JSON.stringify(p));f.files.set(r.file,bytes);r.bytes=bytes.length;r.sha256=sha(bytes);await assert.rejects(deriveBostonScientificPartialEvidence(f))
 }
})

test('Boston freezer preserves four exact original jobs, dates and all receipts in an unused confined output',async()=>{
 const url=pathToFileURL(path.join(reviewedRoot,'scripts/freezeBostonScientificPartialPublishingTrial.js'));assert.ok(fs.existsSync(url),'Boston Scientific exact immutable freezer is required')
 const{freezeBostonScientificPartialTrial}=await import(url),parent=fs.mkdtempSync(path.join(os.tmpdir(),'bostonscientific-proof-')),outputDirectory=path.join(parent,'release')
 try{
  const f=fixture(),result=await freezeBostonScientificPartialTrial({...f,outputDirectory}),bytes=fs.readFileSync(path.join(outputDirectory,'bostonscientific.json')),trial=JSON.parse(bytes)
  assert.equal(result.trialByteHash,sha(bytes));assert.equal(result.eligibleJobs,4);assert.equal(result.indiaJobs,null);assert.equal(result.companyGlobalTotal,null);assert.equal(result.knownNativeIndiaCountryFacet,4);assert.equal(result.unresolvedGeographyRows,7)
  const original=JSON.parse(f.files.get('evidence/frozen-trials/bostonscientific.json'));assert.deepEqual(trial.jobs,original.jobs);assert.equal(trial.attemptedAt,original.attemptedAt);assert.equal(trial.completedAt,original.completedAt)
  for(const[file,body]of f.files)assert.deepEqual(fs.readFileSync(path.join(outputDirectory,file)),body)
  await assert.rejects(freezeBostonScientificPartialTrial({...f,outputDirectory}))
  const bad=fixture();bad.httpEvidence.receipts[0].file='../escape.json';const badOutput=path.join(parent,'bad');await assert.rejects(freezeBostonScientificPartialTrial({...bad,outputDirectory:badOutput}));assert.equal(fs.existsSync(badOutput),false)
 }finally{assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('bostonscientific-proof-'));fs.rmSync(parent,{recursive:true})}
})

test('reviewed Boston002 proof cannot authorize publication after the live runtime geography contract changes',async()=>{
 const {deriveBostonScientificPartialEvidence}=await import(url)
 await assert.rejects(deriveBostonScientificPartialEvidence(fixture()),/current source differs from independently reviewed code/)
})

test('historical Boston001 bytes remain readable but cannot qualify future publication after the reviewed template correction',async()=>{
 const{deriveBostonScientificPartialEvidence}=await load(),old=fixture('001'),frozen=JSON.parse(old.files.get('evidence/frozen-trials/bostonscientific.json'))
 assert.equal(frozen.jobs.length,4);assert.equal(sha(old.files.get('evidence/frozen-trials/bostonscientific.json')),'cebd7abe6ffb8b9056c9c4cba62b95c5693a34477647cfe50c229e2dbe54716f')
 await assert.rejects(deriveBostonScientificPartialEvidence(old))
 const current=fixture();delete current.httpEvidence.reviewVersion;await assert.rejects(deriveBostonScientificPartialEvidence(current))
})

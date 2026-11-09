import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test,{after} from 'node:test'
import {createReviewedProofRuntime,readReviewedSnapshot} from './helpers/reviewedProofRuntime.js'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {deriveZeePartialEvidence as deriveCurrentZeePartialEvidence} from '../scripts/zeePartialPublishingEvidence.js'

const now=new Date('2026-10-20T23:00:00Z'),hash=x=>createHash('sha256').update(x).digest('hex')
const fixture=()=>{
 const raw=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/zeePartial/native-reviewed-005.json.gz',import.meta.url))))
 const files=new Map(Object.entries(raw.files).map(([file,data])=>[file,Buffer.from(data,'base64')]))
 return {source:raw.source,httpEvidence:raw.httpEvidence,files,readEvidence:async file=>files.get(file),now}
}
// Replay the exact reviewed source and the actual Oct21 eligibility policy.
const providerUrl=new URL('../scraper-support/providers/index.js',import.meta.url).href
const relocatedCatalog=Buffer.from(`
import {fileURLToPath} from 'node:url';
import {getScraperCatalog as liveCatalog} from ${JSON.stringify(providerUrl)};
export * from ${JSON.stringify(providerUrl)};
export const getScraperCatalog=(...args)=>liveCatalog(...args).map(provider=>
 provider.source==='zeeentertainmententerprises'
  ? {...provider,modulePath:fileURLToPath(new URL('../../scraper/zeeentertainmententerprises/script.js',import.meta.url))}
  : provider);
`)
const runtime=createReviewedProofRuntime(fixture(),{prefix:'zee-reviewed-proof-',extraFiles:new Map([
 ['scraper-support/providers/index.js',relocatedCatalog],
 ['scraper-support/utils/publishableJobMetrics.js',readReviewedSnapshot(new URL('./fixtures/aeriesPartial/reviewed-publishableJobMetrics-7ebb487d0.js.gz',import.meta.url),'f7d4baf7d52d6f3efd0fe23e5adbfff820f53194f3a3ddfbe7a0982d385b0621')],
])})
after(runtime.cleanup)
const {ZEE_PARTIAL_CONTRACTS,deriveZeePartialEvidence,verifyZeePartialPublishingTrial}=await import(runtime.url('scripts/zeePartialPublishingEvidence.js'))
const {freezeZeePartialTrial}=await import(runtime.url('scripts/freezeZeePartialTrial.js'))
test('Zee production verifier checks the archived source against the current checkout',async()=>{
 const f=fixture(),drift=f.httpEvidence.receipts.filter(r=>r.sourcePath).some(r=>hash(fs.readFileSync(new URL('../'+r.sourcePath,import.meta.url)))!==r.sha256)
 if(drift)await assert.rejects(deriveCurrentZeePartialEvidence(f),/current source differs/)
 else await assert.rejects(deriveCurrentZeePartialEvidence(f),/all and only110 jobs must remain eligible/)
 const receipt=f.httpEvidence.receipts.find(r=>r.kind==='source-code'),file=runtime.url(receipt.sourcePath),bytes=fs.readFileSync(file)
 try {
  fs.writeFileSync(file,Buffer.concat([bytes,Buffer.from('\n// changed source bytes\n')]))
  await assert.rejects(deriveZeePartialEvidence(f),/current source differs/)
 } finally {fs.writeFileSync(file,bytes)}
})

async function trialFor(f){
 const p=await deriveZeePartialEvidence(f)
 const trial={schemaVersion:1,source:f.source,mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence:f.httpEvidence,rawJobs:149,indiaJobs:149,globalTotal:149,observedSelectedIndia:110,
  inventoryEvidence:p.inventoryEvidence,observedSurfaceEvidence:p.observedSurfaceEvidence,bindingEvidence:p.bindingEvidence,detailHealth:p.detailHealth,
  selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,originalCapture:p.originalCapture,jobs:p.jobs}
 return {trial,bytes:Buffer.from(JSON.stringify(trial)),readEvidence:f.readEvidence,now}
}
test('reviewed Zee005 proof preserves149 native records,39 raw empty descriptions and all110 eligible jobs with partial flags',async()=>{
 const f=fixture(),args=await trialFor(f),p=await verifyZeePartialPublishingTrial(args)
 assert.equal(Object.keys(ZEE_PARTIAL_CONTRACTS).length,1);assert.equal(p.eligibleJobs,110);assert.equal(p.rawTotal,149);assert.equal(p.indiaTotal,149)
 assert.equal(p.observedSurfaceEvidence.listingComplete,true);assert.equal(p.observedSurfaceEvidence.pagesFetched,15)
 assert.equal(p.inventoryEvidence.listingComplete,false);assert.equal(p.detailHealth.complete,false);assert.equal(p.detailHealth.missingDescriptions,39)
 assert.equal(p.selectedDetailHealth.complete,true);assert.equal(p.replayEvidence.requestsUsed,167)
 const original=JSON.parse(f.files.get('evidence/capture-trial.json'));assert.equal(original.jobs.length,149)
 assert.equal(args.trial.attemptedAt,original.attemptedAt);assert.equal(args.trial.completedAt,original.completedAt)
 for(const job of p.jobs){const old=original.jobs.find(j=>j.jobId===job.jobId);const {companyDomain,companyCareerPage,...unchanged}=job
  assert.deepEqual(unchanged,old);assert.equal(companyDomain,'zee.com');assert.equal(companyCareerPage,'https://www.zee.com/careers/')
  assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceDetailComplete,true)}
})
test('selected jobs, raw descriptions, timestamps, identity and partial diagnostics cannot be changed or truncated',async()=>{
 const args=await trialFor(fixture())
 for(const mutate of [
  t=>{t.jobs.pop()},t=>{t.jobs[0].sourceDescription='<p>Invented content</p>'},t=>{t.jobs[0].country='US'},
  t=>{t.jobs[0].companyDomain='sensehq.com'},t=>{t.jobs[0].applyUrl='https://example.com/fake'},t=>{t.jobs[0].sourceListingComplete=true},
  t=>{t.inventoryEvidence.listingComplete=true},t=>{t.observedSurfaceEvidence.reportedTotal=110},t=>{t.detailHealth.complete=true},
  t=>{t.filterCounts.emptyDescription=0},t=>{t.maxJobs=110},t=>{t.truncated=true},t=>{t.completedAt=now.toISOString()},
 ]){const trial=structuredClone(args.trial);mutate(trial);await assert.rejects(verifyZeePartialPublishingTrial({...args,trial,bytes:Buffer.from(JSON.stringify(trial))}))}
})
test('stale, missing, duplicated, copied or tampered native proof cannot qualify even with refreshed caller hashes',async()=>{
 for(const change of [
  f=>{f.now=new Date('2026-10-23T23:00:00Z')},f=>{f.httpEvidence.receipts.pop()},f=>{f.httpEvidence.receipts.push({...f.httpEvidence.receipts[0]})},
  f=>{f.files.set('evidence/capture-trial.json',Buffer.from('{}'))},f=>{f.files.set('evidence/independent-review.json',Buffer.from('{}'))},
  f=>{f.httpEvidence.receipts=f.httpEvidence.receipts.filter(r=>r.kind!=='source-code')},
  f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='native'),p=JSON.parse(f.files.get(r.file));p.status=503;const b=Buffer.from(JSON.stringify(p));f.files.set(r.file,b);Object.assign(r,{bytes:b.length,sha256:hash(b)})},
  f=>{const r=f.httpEvidence.receipts.find(r=>r.kind==='native'),p=JSON.parse(f.files.get(r.file));p.completedAt=now.toISOString();const b=Buffer.from(JSON.stringify(p));f.files.set(r.file,b);Object.assign(r,{bytes:b.length,sha256:hash(b)})},
  f=>{f.httpEvidence.receipts[0].file='evidence/../outside.json'},
 ]){const f=fixture();change(f);await assert.rejects(deriveZeePartialEvidence(f))}
})
test('unsupported source, completed outcome and false global scope cannot use this exact positive contract',async()=>{
 const args=await trialFor(fixture())
 for(const mutate of [t=>{t.source='zeemedia'},t=>{t.outcome='extracted'},t=>{t.productionWrites=true},t=>{t.globalTotal=110},t=>{t.rawJobs=null}]){
  const trial=structuredClone(args.trial);mutate(trial);await assert.rejects(verifyZeePartialPublishingTrial({...args,trial,bytes:Buffer.from(JSON.stringify(trial))}))
 }
})
test('the isolated verifier works when imported from inline ESM callers',()=>{
 const entry=`import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {deriveZeePartialEvidence} from ${JSON.stringify(runtime.url('scripts/zeePartialPublishingEvidence.js').href)};
 const raw=JSON.parse(gunzipSync(fs.readFileSync(new URL(${JSON.stringify(new URL('./fixtures/zeePartial/native-reviewed-005.json.gz',import.meta.url).href)}))));
 const files=new Map(Object.entries(raw.files).map(([k,v])=>[k,Buffer.from(v,'base64')]));
 const proof=await deriveZeePartialEvidence({source:raw.source,httpEvidence:raw.httpEvidence,readEvidence:async f=>files.get(f),now:new Date('2026-10-20T23:00:00Z')});console.log(proof.jobs.length)`
 const result=spawnSync(process.execPath,['--input-type=module','--eval',entry],{encoding:'utf8',timeout:15000})
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'110')
})
test('offline freezer preserves exact original proof and refuses output reuse or escaped native archives',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zee-partial-'))
 t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('zee-partial-'));fs.rmSync(dir,{recursive:true,force:true})})
 const f=fixture(),native=path.join(dir,'native');fs.mkdirSync(native)
 fs.writeFileSync(path.join(native,'manifest.json'),f.files.get('evidence/capture-manifest.json'));fs.writeFileSync(path.join(native,'trial.json'),f.files.get('evidence/capture-trial.json'))
 for(const r of f.httpEvidence.receipts.filter(r=>r.kind==='native'))fs.writeFileSync(path.join(native,r.originFile),f.files.get(r.file))
 const reviewFile=path.join(dir,'review.json'),providerFile=path.join(dir,'provider.json');fs.writeFileSync(reviewFile,f.files.get('evidence/independent-review.json'));fs.writeFileSync(providerFile,f.files.get('evidence/provider-extension.json'))
 const options={nativeManifestFile:path.join(native,'manifest.json'),reviewFile,providerFile,outputDirectory:path.join(dir,'release'),now}
 const frozen=await freezeZeePartialTrial(options),bytes=fs.readFileSync(frozen.file),trial=JSON.parse(bytes),readEvidence=async relative=>fs.readFileSync(path.join(options.outputDirectory,relative))
 assert.equal((await verifyZeePartialPublishingTrial({trial,bytes,readEvidence,now})).eligibleJobs,110)
 assert.deepEqual(fs.readFileSync(path.join(options.outputDirectory,'evidence/capture-trial.json')),f.files.get('evidence/capture-trial.json'))
 await assert.rejects(freezeZeePartialTrial(options),/exist/i)
 const manifest=JSON.parse(f.files.get('evidence/capture-manifest.json'));manifest.receipts[0].file='../outside.json';fs.writeFileSync(options.nativeManifestFile,JSON.stringify(manifest))
 await assert.rejects(freezeZeePartialTrial({...options,outputDirectory:path.join(dir,'escaped')}),/reviewed|hash|escape/i);assert.equal(fs.existsSync(path.join(dir,'escaped')),false)
})

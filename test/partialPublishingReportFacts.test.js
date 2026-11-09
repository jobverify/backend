import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readOrCreatePartialReportAudit} from '../scripts/partialPublishingReportFacts.js'
import {buildPublishingGapReport} from '../scripts/publishingGapReport.js'
const now=new Date('2026-10-20T23:00:00Z'),later=new Date('2026-10-23T23:00:00Z'),hash=x=>createHash('sha256').update(x).digest('hex')
const backend=fileURLToPath(new URL('../',import.meta.url))
function frozenHistoricalCache(source,trialBytes,cacheDirectory){
 const bytes=fs.readFileSync(new URL('./fixtures/partialReport/historical-zee-navi-cache-001.json.gz',import.meta.url))
 assert.equal(hash(bytes),'0d22a182a2d0d483b70373b86bf008b5d64654e097998b2ebc230b0a45308ecd')
 const frozen=JSON.parse(gunzipSync(bytes)).sources[source],indexBytes=Buffer.from(frozen.indexBase64,'base64'),factsBytes=Buffer.from(frozen.factsBase64,'base64'),index=JSON.parse(indexBytes)
 assert.equal(hash(trialBytes),frozen.trialByteHash);assert.equal(hash(indexBytes),frozen.indexSha256);assert.equal(hash(factsBytes),frozen.factsSha256)
 assert.equal(index.source,source);assert.equal(index.trialByteHash,frozen.trialByteHash);assert.equal(index.artifact,frozen.artifact)
 assert.equal(frozen.indexFilename,hash(source+'\0'+index.artifact)+'-'+hash(indexBytes)+'.index.json')
 assert.equal(frozen.factsFilename,index.factsSha256+'.facts.json')
 // Copy the original immutable cache bytes; do not recreate facts through a current gate.
 fs.mkdirSync(cacheDirectory)
 fs.writeFileSync(path.join(cacheDirectory,frozen.indexFilename),indexBytes,{flag:'wx'})
 fs.writeFileSync(path.join(cacheDirectory,frozen.factsFilename),factsBytes,{flag:'wx'})
 return index
}
function fixture(t,kind='phonepe'){
 const zee=kind==='zee',navi=kind==='navi'
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'partial-report-'))
 t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('partial-report-'));fs.rmSync(dir,{recursive:true,force:true})})
 const raw=JSON.parse(gunzipSync(fs.readFileSync(new URL(navi?'./fixtures/naviPartial/reviewed-native-003.json.gz':zee?'./fixtures/zeePartial/native-reviewed-005.json.gz':'./fixtures/partialReport/phonepe-actual-001.json.gz',import.meta.url))))
 const source=zee||navi?raw.source:'phonepe',trialDirectory=path.join(dir,'trial');fs.mkdirSync(trialDirectory)
 let trialBytes
 if(zee||navi){
  // Preserve the exact frozen selected jobs and their original evidence packets.
  trialBytes=gunzipSync(fs.readFileSync(new URL(navi?'./fixtures/partialReport/navi-frozen-partial-002.json.gz':'./fixtures/partialReport/zee-frozen-partial-001.json.gz',import.meta.url)))
  for(const [name,data]of Object.entries(raw.files)){const file=path.join(trialDirectory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(data,'base64'))}
 }else{
  trialBytes=Buffer.from(raw.files[raw.trialFile])
  for(const [name,data]of Object.entries(raw.files)){const file=path.join(trialDirectory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data)}
 }
 const trialFile=path.join(trialDirectory,`${source}.json`);fs.writeFileSync(trialFile,trialBytes)
 const cacheDirectory=path.join(dir,'cache'),frozen=zee||navi?frozenHistoricalCache(source,trialBytes,cacheDirectory):null
 return {source,trialFile,artifact:frozen?.artifact??`actual/${source}.json`,expectedTrialByteHash:hash(trialBytes),cacheDirectory,now:frozen?new Date(frozen.checkedAt):now,trial:JSON.parse(trialBytes)}
}
const options=f=>({source:f.source,trialFile:f.trialFile,artifact:f.artifact,expectedTrialByteHash:f.expectedTrialByteHash,cacheDirectory:f.cacheDirectory,now:f.now})
const report=(source,audit,at)=>buildPublishingGapReport({catalog:[{source,companyName:source,adapter:'apiPortal'}],runtime:{databaseAvailable:false},extractionAudits:[audit],now:at})
test('actual PhonePe facts remain historical after72hours and the report core nulls stale metrics',async t=>{
 const f=fixture(t),fresh=await readOrCreatePartialReportAudit(options(f)),files=fs.readdirSync(f.cacheDirectory)
 assert.equal(fresh.rawJobs,633);assert.equal(fresh.indiaJobs,109);assert.equal(fresh.eligibleJobs,107);assert.equal(fresh.filterCounts.emptyDescription,2)
 const stale=await readOrCreatePartialReportAudit({...options(f),now:later})
 assert.deepEqual(stale,fresh);assert.deepEqual(fs.readdirSync(f.cacheDirectory),files);assert.equal(stale.completedAt,f.trial.completedAt)
 const row=report(f.source,stale,later).rows[0]
 assert.equal(row.extractionAuditFresh,false)
 for(const field of ['extractionAuditRawJobs','extractionAuditExtractedJobs','extractionAuditIndiaJobs','extractionAuditEligibleJobs','extractionAuditRejectionCounts'])assert.equal(row[field],null)
 assert.equal(report(f.source,stale,later).summary.completeSuccessfulChecks,0)
})
test('changed or missing cached facts/index/receipt bytes become unavailable rather than aborting or zero',async t=>{
 for(const target of ['facts','index','receipt','trial','missing-facts','missing-trial','missing-receipt']){
  const f=fixture(t);await readOrCreatePartialReportAudit(options(f));const names=fs.readdirSync(f.cacheDirectory)
  const file=target==='facts'||target==='missing-facts'?path.join(f.cacheDirectory,names.find(n=>n.endsWith('.facts.json')))
   :target==='index'?path.join(f.cacheDirectory,names.find(n=>n.endsWith('.index.json'))):target==='trial'||target==='missing-trial'?f.trialFile:path.join(path.dirname(f.trialFile),f.trial.httpEvidence.receipts[0].file)
  if(target.startsWith('missing-'))fs.unlinkSync(file);else fs.appendFileSync(file,' ')
  const row=await readOrCreatePartialReportAudit({...options(f),now:later})
  assert.equal(row.outcome,'extraction-failed');assert.equal(row.inventoryEvidence,null);assert.equal(row.completedAt,f.trial.completedAt)
  for(const key of ['rawJobs','extractedJobs','indiaJobs','eligibleJobs','filterCounts','detailHealth'])assert.equal(row[key],null)
  assert.match(row.error,/unavailable/i)
 }
})
test('missing cache and stale or tampered trial cannot manufacture verified empty evidence',async t=>{
 const f=fixture(t),stale=await readOrCreatePartialReportAudit({...options(f),now:later})
 assert.equal(stale.inventoryEvidence,null);assert.equal(stale.eligibleJobs,null);assert.equal(stale.completedAt,f.trial.completedAt)
 assert.equal(fs.existsSync(f.cacheDirectory),false)
 const trial=structuredClone(f.trial);trial.jobs=[];trial.inventoryEvidence={status:'verified-empty',firstParty:true,listingComplete:true,reportedTotal:0};fs.writeFileSync(f.trialFile,JSON.stringify(trial))
 const row=await readOrCreatePartialReportAudit({...options(f),now:later})
 assert.equal(row.eligibleJobs,null);assert.equal(row.rawJobs,null);assert.equal(row.inventoryEvidence,null)
 assert.equal(report(f.source,row,later).summary.completeSuccessfulChecks,0)
})
test('cached actual Zee facts survive a legitimate current-source hash change without calling its publication gate',async t=>{
 const f=fixture(t,'zee'),fresh=await readOrCreatePartialReportAudit(options(f)),target=path.join(backend,'scraper/zeeentertainmententerprises/native.js'),read=fs.readFileSync
 let currentSourceReads=0
 t.mock.method(fs,'readFileSync',(file,...args)=>{if(path.resolve(String(file))===target){currentSourceReads++;return Buffer.concat([read(file),Buffer.from('\n// future source version')])}return read(file,...args)})
 // Preserve the changed-current-code negative precondition without invoking publication admission.
 const reviewedSource=f.trial.httpEvidence.receipts.find(receipt=>receipt.kind==='source-code'&&receipt.sourcePath==='scraper/zeeentertainmententerprises/native.js')
 assert.ok(reviewedSource)
 assert.equal(hash(read(path.join(path.dirname(f.trialFile),reviewedSource.file))),reviewedSource.sha256)
 assert.notEqual(hash(fs.readFileSync(target)),reviewedSource.sha256,'Changed current source cannot match the frozen publication code seal')
 assert.ok(currentSourceReads>0);currentSourceReads=0
 const historical=await readOrCreatePartialReportAudit({...options(f),now:later})
 assert.deepEqual(historical,fresh);assert.equal(historical.eligibleJobs,110);assert.equal(currentSourceReads,0)
})
test('actual Navi38/36/missing2 remains partial history after72hours without publication or source-code reads',async t=>{
 const f=fixture(t,'navi'),fresh=await readOrCreatePartialReportAudit(options(f)),read=fs.readFileSync
 assert.equal(f.expectedTrialByteHash,'79fb7c8c1a5eea29989cf333c69493b877dfcb54cd1bdfbb5228d416ffbacd78')
 assert.equal(fresh.rawJobs,38);assert.equal(fresh.indiaJobs,38);assert.equal(fresh.eligibleJobs,36)
 assert.equal(fresh.filterCounts.emptyDescription,2);assert.equal(fresh.detailHealth.complete,false);assert.equal(fresh.inventoryEvidence.listingComplete,false)
 t.mock.method(fs,'readFileSync',(file,...args)=>{
  assert.ok(!path.resolve(String(file)).startsWith(path.resolve(backend)+path.sep),'Historical facts must not read current publication or source code')
  return read(file,...args)
 })
 const historical=await readOrCreatePartialReportAudit({...options(f),now:new Date('2026-10-23T23:30:00Z')})
 assert.deepEqual(historical,fresh);assert.equal(historical.completedAt,f.trial.completedAt)
 const output=report(f.source,historical,new Date('2026-10-23T23:30:00Z'))
 assert.equal(output.rows[0].extractionAuditFresh,false);assert.equal(output.rows[0].extractionAuditEligibleJobs,null)
 assert.equal(output.rows[0].extractionAuditRawJobs,null);assert.equal(output.rows[0].extractionAuditIndiaJobs,null)
 assert.equal(output.rows[0].extractionAuditRejectionCounts,null);assert.equal(output.summary.completeSuccessfulChecks,0)
})

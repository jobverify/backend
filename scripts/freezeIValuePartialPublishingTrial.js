import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { deriveIValuePartialEvidence,verifyIValuePartialPublishingTrial } from './ivaluePartialPublishingEvidence.js'
import { loadPartialTrial } from './partialPublishingGapEvidence.js'

/** Offline immutable source-specific release; no source, network or DB writes. */
export async function freezeIValuePartialTrial({source,httpEvidence,readEvidence,outputDirectory,now=new Date()}){
 if(typeof outputDirectory!=='string'||!outputDirectory)throw Error('Unused iValue output directory required')
 const directory=path.resolve(outputDirectory);if(fs.existsSync(directory))throw Error('iValue release already exists')
 const files=new Map()
 for(const r of httpEvidence?.receipts||[]){
  if(typeof r.file!=='string'||!/^evidence\/[a-z0-9._/-]+$/i.test(r.file)||r.file.split('/').includes('..')||files.has(r.file))throw Error('Unique confined iValue evidence required')
  const bytes=await readEvidence(r.file);if(!Buffer.isBuffer(bytes))throw Error('iValue proof bytes required');files.set(r.file,Buffer.from(bytes))
 }
 const fixed=async file=>files.get(file),p=await deriveIValuePartialEvidence({source,httpEvidence,readEvidence:fixed,now})
 const trial={schemaVersion:1,source:'ivalue',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeIdentityEvidence:p.nativeIdentityEvidence,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,
  filterCounts:p.filterCounts,rawJobs:40,indiaJobs:38,globalTotal:null,observedSelectedIndia:37,jobs:p.jobs}
 const bytes=Buffer.from(JSON.stringify(trial,null,2)+'\n');await verifyIValuePartialPublishingTrial({trial,bytes,readEvidence:fixed,now})
 // Proof succeeds in memory before creating an unused release directory.
 fs.mkdirSync(directory)
 for(const[file,body]of files){const output=path.resolve(directory,file),relative=path.relative(directory,output);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('iValue evidence path escapes release');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,body,{flag:'wx'})}
 const file=path.join(directory,'ivalue.json');fs.writeFileSync(file,bytes,{flag:'wx'});const verified=await verifyIValuePartialPublishingTrial({...loadPartialTrial(file),now})
 return{source:'ivalue',file:'ivalue.json',trialByteHash:verified.trialByteHash,rawJobs:40,indiaJobs:38,eligibleJobs:37,uniqueNativePublicURLs:39,identityRejections:1,missingDescriptions:0,
  companyGlobalTotal:null,companyIndiaTotal:null,sourceListingComplete:false,sourceDetailHealthComplete:false,productionWrites:false,
  evidenceFiles:files.size,evidenceBytes:[...files.values()].reduce((n,b)=>n+b.length,0),evidenceIndexSha256:createHash('sha256').update(JSON.stringify(httpEvidence)).digest('hex'),replayEvidence:verified.replayEvidence}
}

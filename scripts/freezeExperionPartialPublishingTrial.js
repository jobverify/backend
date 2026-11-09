import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {deriveExperionPartialEvidence,verifyExperionPartialPublishingTrial} from './experionPartialPublishingEvidence.js'
import {loadPartialTrial} from './partialPublishingGapEvidence.js'

/** Immutable offline selected-role release; no source, network or DB writes. */
export async function freezeExperionPartialTrial({source,httpEvidence,readEvidence,outputDirectory,now=new Date()}){
 if(typeof outputDirectory!=='string'||!outputDirectory)throw Error('Unused Experion output directory required')
 const directory=path.resolve(outputDirectory);if(fs.existsSync(directory))throw Error('Experion release already exists')
 const files=new Map()
 for(const r of httpEvidence?.receipts||[]){if(typeof r.file!=='string'||!/^evidence\/[a-z0-9._/-]+$/i.test(r.file)||r.file.split('/').includes('..')||files.has(r.file))throw Error('Unique confined Experion evidence required');const bytes=await readEvidence(r.file);if(!Buffer.isBuffer(bytes))throw Error('Experion proof bytes required');files.set(r.file,Buffer.from(bytes))}
 const fixed=async file=>files.get(file),p=await deriveExperionPartialEvidence({source,httpEvidence,readEvidence:fixed,now})
 const trial={schemaVersion:1,source:'experiontechnologies',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeRemoteScopeEvidence:p.nativeRemoteScopeEvidence,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,
  rawJobs:29,indiaJobs:null,globalTotal:null,observedSelectedIndia:29,jobs:p.jobs}
 const bytes=Buffer.from(JSON.stringify(trial,null,2)+'\n');await verifyExperionPartialPublishingTrial({trial,bytes,readEvidence:fixed,now})
 fs.mkdirSync(directory)
 for(const[file,body]of files){const output=path.resolve(directory,file),relative=path.relative(directory,output);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Experion evidence path escapes release');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,body,{flag:'wx'})}
 const file=path.join(directory,'experiontechnologies.json');fs.writeFileSync(file,bytes,{flag:'wx'});const verified=await verifyExperionPartialPublishingTrial({...loadPartialTrial(file),now})
 return{source:'experiontechnologies',file:'experiontechnologies.json',trialByteHash:verified.trialByteHash,rawJobs:29,indiaJobs:null,eligibleJobs:29,observedNativeCards:29,unboundedRemoteScopes:4,missingDescriptions:0,
  companyGlobalTotal:null,companyIndiaTotal:null,sourceListingComplete:false,sourceDetailHealthComplete:false,productionWrites:false,evidenceFiles:files.size,evidenceBytes:[...files.values()].reduce((n,b)=>n+b.length,0),evidenceIndexSha256:createHash('sha256').update(JSON.stringify(httpEvidence)).digest('hex'),replayEvidence:verified.replayEvidence}
}

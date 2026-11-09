import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {deriveFinacusPartialEvidence,verifyFinacusPartialPublishingTrial} from './finacusPartialPublishingEvidence.js'
import {loadPartialTrial} from './partialPublishingGapEvidence.js'

/** Freeze original native records without changing their clocks or company scope. */
export async function freezeFinacusPartialTrial({source,httpEvidence,readEvidence,outputDirectory,now=new Date()}){
 if(typeof outputDirectory!=='string'||!outputDirectory)throw Error('Unused Finacus output directory required')
 const directory=path.resolve(outputDirectory);if(fs.existsSync(directory))throw Error('Finacus release already exists')
 const files=new Map()
 for(const r of httpEvidence?.receipts||[]){if(typeof r.file!=='string'||!/^evidence\/[a-z0-9._/-]+$/i.test(r.file)||r.file.split('/').includes('..')||files.has(r.file))throw Error('Unique confined Finacus evidence required');const bytes=await readEvidence(r.file);if(!Buffer.isBuffer(bytes))throw Error('Finacus proof bytes required');files.set(r.file,Buffer.from(bytes))}
 const fixed=async file=>files.get(file),p=await deriveFinacusPartialEvidence({source,httpEvidence,readEvidence:fixed,now})
 const trial={schemaVersion:1,source:'finacussolutions',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeUnresolvedScopeEvidence:p.nativeUnresolvedScopeEvidence,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,
  rawJobs:20,indiaJobs:null,globalTotal:null,observedSelectedIndia:20,jobs:p.jobs}
 const bytes=Buffer.from(JSON.stringify(trial,null,2)+'\n');await verifyFinacusPartialPublishingTrial({trial,bytes,readEvidence:fixed,now})
 fs.mkdirSync(directory)
 for(const[file,body]of files){const output=path.resolve(directory,file),relative=path.relative(directory,output);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Finacus evidence escapes release');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,body,{flag:'wx'})}
 const file=path.join(directory,'finacussolutions.json');fs.writeFileSync(file,bytes,{flag:'wx'});const verified=await verifyFinacusPartialPublishingTrial({...loadPartialTrial(file),now})
 return{source:'finacussolutions',file:'finacussolutions.json',trialByteHash:verified.trialByteHash,rawJobs:20,indiaJobs:null,eligibleJobs:20,observedNativeCards:20,scopedIndiaCapableCards:20,missingDescriptions:0,companyGlobalTotal:null,companyIndiaTotal:null,sourceListingComplete:false,sourceDetailHealthComplete:false,productionWrites:false,evidenceFiles:files.size,evidenceBytes:[...files.values()].reduce((n,b)=>n+b.length,0),evidenceIndexSha256:createHash('sha256').update(JSON.stringify(httpEvidence)).digest('hex'),replayEvidence:verified.replayEvidence}
}

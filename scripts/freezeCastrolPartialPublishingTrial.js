import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {deriveCastrolPartialEvidence,verifyCastrolPartialPublishingTrial} from './castrolPartialPublishingEvidence.js'
import {loadPartialTrial} from './partialPublishingGapEvidence.js'

/** Immutable offline selection from original HTTP and the named derived fix. */
export async function freezeCastrolPartialTrial({source,httpEvidence,readEvidence,outputDirectory,now=new Date()}){
 if(typeof outputDirectory!=='string'||!outputDirectory)throw Error('Unused Castrol output directory required')
 const directory=path.resolve(outputDirectory);if(fs.existsSync(directory))throw Error('Castrol release already exists')
 const files=new Map()
 for(const r of httpEvidence?.receipts||[]){if(typeof r.file!=='string'||!/^evidence\/[a-z0-9._/-]+$/i.test(r.file)||r.file.split('/').includes('..')||files.has(r.file))throw Error('Unique confined Castrol evidence required');const bytes=await readEvidence(r.file);if(!Buffer.isBuffer(bytes))throw Error('Castrol proof bytes required');files.set(r.file,Buffer.from(bytes))}
 const fixed=async file=>files.get(file),p=await deriveCastrolPartialEvidence({source,httpEvidence,readEvidence:fixed,now})
 const trial={schemaVersion:1,source:'castrolindia',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeUnresolvedScopeEvidence:p.nativeUnresolvedScopeEvidence,derivedFieldCorrections:p.derivedFieldCorrections,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,
  rawJobs:101,indiaJobs:null,globalTotal:null,observedSelectedIndia:21,jobs:p.jobs}
 const bytes=Buffer.from(JSON.stringify(trial,null,2)+'\n');await verifyCastrolPartialPublishingTrial({trial,bytes,readEvidence:fixed,now})
 fs.mkdirSync(directory)
 for(const[file,body]of files){const output=path.resolve(directory,file),relative=path.relative(directory,output);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Castrol evidence path escapes release');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,body,{flag:'wx'})}
 const file=path.join(directory,'castrolindia.json');fs.writeFileSync(file,bytes,{flag:'wx'});const verified=await verifyCastrolPartialPublishingTrial({...loadPartialTrial(file),now})
 return{source:'castrolindia',file:'castrolindia.json',trialByteHash:verified.trialByteHash,rawJobs:101,indiaJobs:null,eligibleJobs:21,observedNativeRecords:101,scopedExplicitIndiaCapableRoles:21,missingDescriptions:0,
  companyGlobalTotal:null,companyIndiaTotal:null,sourceListingComplete:false,sourceDetailHealthComplete:false,derivedCanonicalCountryCorrections:1,productionWrites:false,evidenceFiles:files.size,evidenceBytes:[...files.values()].reduce((n,b)=>n+b.length,0),evidenceIndexSha256:createHash('sha256').update(JSON.stringify(httpEvidence)).digest('hex'),replayEvidence:verified.replayEvidence}
}

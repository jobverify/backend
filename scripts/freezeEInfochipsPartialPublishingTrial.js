import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {deriveEInfochipsPartialEvidence,verifyEInfochipsPartialPublishingTrial} from './eInfochipsPartialPublishingEvidence.js'
import {loadPartialTrial} from './partialPublishingGapEvidence.js'

/** Immutable offline selected-role release; no source, network or DB writes. */
export async function freezeEInfochipsPartialTrial({source,httpEvidence,readEvidence,outputDirectory,now=new Date()}){
 if(typeof outputDirectory!=='string'||!outputDirectory)throw Error('Unused eInfochips output directory required')
 const directory=path.resolve(outputDirectory);if(fs.existsSync(directory))throw Error('eInfochips release already exists')
 const files=new Map()
 for(const r of httpEvidence?.receipts||[]){if(typeof r.file!=='string'||!/^evidence\/[a-z0-9._/-]+$/i.test(r.file)||r.file.split('/').includes('..')||files.has(r.file))throw Error('Unique confined eInfochips evidence required');const bytes=await readEvidence(r.file);if(!Buffer.isBuffer(bytes))throw Error('eInfochips proof bytes required');files.set(r.file,Buffer.from(bytes))}
 const fixed=async file=>files.get(file),p=await deriveEInfochipsPartialEvidence({source,httpEvidence,readEvidence:fixed,now})
 const trial={schemaVersion:1,source:'einfochips',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence,originalCapture:p.originalCapture,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,
  nativeBoardEvidence:p.nativeBoardEvidence,nativeMissingDescriptions:p.nativeMissingDescriptions,nativeLegalEmployerEvidence:p.nativeLegalEmployerEvidence,companyScope:p.companyScope,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,
  filterCounts:p.filterCounts,rawJobs:30,indiaJobs:null,globalTotal:null,observedSelectedIndia:25,jobs:p.jobs}
 const bytes=Buffer.from(JSON.stringify(trial,null,2)+'\n');await verifyEInfochipsPartialPublishingTrial({trial,bytes,readEvidence:fixed,now})
 fs.mkdirSync(directory)
 for(const[file,body]of files){const output=path.resolve(directory,file),relative=path.relative(directory,output);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('eInfochips evidence path escapes release');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,body,{flag:'wx'})}
 const file=path.join(directory,'einfochips.json');fs.writeFileSync(file,bytes,{flag:'wx'});const verified=await verifyEInfochipsPartialPublishingTrial({...loadPartialTrial(file),now})
 return{source:'einfochips',file:'einfochips.json',trialByteHash:verified.trialByteHash,rawJobs:30,indiaJobs:null,eligibleJobs:25,observedIndiaKeywordRows:30,missingDescriptions:5,blankNativeLegalEmployers:5,selectedBlankNativeLegalEmployers:2,
  companyGlobalTotal:null,companyIndiaTotal:null,legalEntityCoverageComplete:false,sourceListingComplete:false,sourceDetailHealthComplete:false,productionWrites:false,evidenceFiles:files.size,evidenceBytes:[...files.values()].reduce((n,b)=>n+b.length,0),evidenceIndexSha256:createHash('sha256').update(JSON.stringify(httpEvidence)).digest('hex'),replayEvidence:verified.replayEvidence}
}

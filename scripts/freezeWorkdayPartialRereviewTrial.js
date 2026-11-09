import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {deriveWorkdayPartialRereviewEvidence,verifyWorkdayPartialRereviewTrial} from './workdayPartialRereviewEvidence.js'
import {loadPartialTrial} from './partialPublishingGapEvidence.js'

/** New immutable version: original022 content/clocks plus explicit code review. */
export async function freezeWorkdayPartialRereviewTrial({source,httpEvidence,readEvidence,outputDirectory,now=new Date()}){
 if(typeof outputDirectory!=='string'||!outputDirectory)throw Error('Unused Workday rereview output directory required')
 const directory=path.resolve(outputDirectory);if(fs.existsSync(directory))throw Error('Workday rereview release already exists')
 const files=new Map();for(const r of httpEvidence?.receipts||[]){if(typeof r.file!=='string'||!/^evidence\/[a-z0-9._/-]+$/i.test(r.file)||r.file.split('/').includes('..')||files.has(r.file))throw Error('Unique confined Workday rereview evidence required');const bytes=await readEvidence(r.file);if(!Buffer.isBuffer(bytes))throw Error('Workday proof bytes required');files.set(r.file,Buffer.from(bytes))}
 const fixed=async file=>files.get(file),p=await deriveWorkdayPartialRereviewEvidence({source,httpEvidence,readEvidence:fixed,now}),trial={schemaVersion:1,source,mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence,originalCapture:p.originalCapture,codeRereview:p.codeRereview,bindingEvidence:p.bindingEvidence,inventoryEvidence:p.inventoryEvidence,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,filterCounts:p.filterCounts,rawJobs:null,indiaJobs:null,globalTotal:null,observedSelectedIndia:p.jobs.length,jobs:p.jobs},bytes=Buffer.from(JSON.stringify(trial,null,2)+'\n')
 await verifyWorkdayPartialRereviewTrial({trial,bytes,readEvidence:fixed,now});fs.mkdirSync(directory)
 for(const[file,body]of files){const output=path.resolve(directory,file),relative=path.relative(directory,output);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Workday rereview evidence path escapes release');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,body,{flag:'wx'})}
 const file=source+'.json',target=path.join(directory,file);fs.writeFileSync(target,bytes,{flag:'wx'});const verified=await verifyWorkdayPartialRereviewTrial({...loadPartialTrial(target),now})
 return{source,file,trialByteHash:verified.trialByteHash,eligibleJobs:p.jobs.length,rawJobs:null,indiaJobs:null,globalTotal:null,originalPartialTrialSha256:p.codeRereview.originalPartialTrialSha256,currentCodeReviewSha256:p.codeRereview.reviewSha256,originalJobFieldsAndClocksPreserved:true,sourceListingComplete:false,sourceDetailHealthComplete:false,productionWrites:false,evidenceFiles:files.size,evidenceBytes:[...files.values()].reduce((n,b)=>n+b.length,0),evidenceIndexSha256:createHash('sha256').update(JSON.stringify(httpEvidence)).digest('hex'),replayEvidence:verified.replayEvidence}
}

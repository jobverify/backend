import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { deriveNaviPartialEvidence,verifyNaviPartialPublishingTrial } from './naviPartialPublishingEvidence.js'
import { loadPartialTrial } from './partialPublishingGapEvidence.js'

/** Freeze exact reviewed public evidence offline. Existing releases are immutable. */
export async function freezeNaviPartialTrial({source,httpEvidence,readEvidence,outputDirectory,now=new Date()}){
 if(!outputDirectory||typeof outputDirectory!=='string')throw Error('Unused Navi output directory required')
 const directory=path.resolve(outputDirectory)
 if(fs.existsSync(directory))throw Error('Navi partial output already exists')
 const files=new Map()
 for(const receipt of httpEvidence?.receipts||[]){
  if(typeof receipt.file!=='string'||!/^evidence\/[a-z0-9._/-]+$/i.test(receipt.file)||receipt.file.split('/').includes('..')||files.has(receipt.file))throw Error('Unique confined Navi evidence path required')
  const bytes=await readEvidence(receipt.file)
  if(!Buffer.isBuffer(bytes))throw Error('Navi evidence bytes required')
  files.set(receipt.file,Buffer.from(bytes))
 }
 const fixedReader=async file=>files.get(file),p=await deriveNaviPartialEvidence({source,httpEvidence,readEvidence:fixedReader,now})
 const trial={schemaVersion:1,source:'navi',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:p.startedAt,completedAt:p.capturedAt,httpEvidence,originalCapture:p.originalCapture,sourceNativeInventoryEvidence:p.sourceNativeInventoryEvidence,
  inventoryEvidence:p.inventoryEvidence,bindingEvidence:p.bindingEvidence,detailHealth:p.detailHealth,selectedDetailHealth:p.selectedDetailHealth,missingNativeDetails:p.missingNativeDetails,
  filterCounts:p.filterCounts,rawJobs:38,indiaJobs:38,globalTotal:38,observedSelectedIndia:36,jobs:p.jobs}
 const bytes=Buffer.from(JSON.stringify(trial,null,2)+'\n')
 await verifyNaviPartialPublishingTrial({trial,bytes,readEvidence:fixedReader,now})
 // No output directory or files are created until the complete proof succeeds.
 fs.mkdirSync(directory)
 for(const[file,body]of files){const output=path.resolve(directory,file),relative=path.relative(directory,output);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Navi output escapes release');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,body,{flag:'wx'})}
 const filename=path.join(directory,'navi.json');fs.writeFileSync(filename,bytes,{flag:'wx'})
 const verified=await verifyNaviPartialPublishingTrial({...loadPartialTrial(filename),now})
 return{source:'navi',file:'navi.json',trialByteHash:verified.trialByteHash,eligibleJobs:36,rawJobs:38,indiaJobs:38,missingDescriptions:2,
  sourceListingComplete:false,sourceDetailHealthComplete:false,originalNativeListingComplete:true,productionWrites:false,
  evidenceFiles:files.size,evidenceBytes:[...files.values()].reduce((n,b)=>n+b.length,0),
  evidenceIndexSha256:createHash('sha256').update(JSON.stringify(httpEvidence)).digest('hex'),replayEvidence:verified.replayEvidence}
}

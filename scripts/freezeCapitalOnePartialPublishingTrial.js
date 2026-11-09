import fs from 'node:fs'
import path from 'node:path'
import {deriveCapitalOnePartialEvidence,verifyCapitalOnePartialPublishingTrial,createCapitalOnePartialTrial} from './capitalOnePartialPublishingEvidence.js'
export async function freezeCapitalOnePartialTrial({source,httpEvidence,readEvidence,outputDirectory,now=new Date()}){
 if(typeof outputDirectory!=='string'||!outputDirectory)throw Error('Unused Capital One output directory required')
 const directory=path.resolve(outputDirectory);if(fs.existsSync(directory))throw Error('Capital One release already exists')
 const files=new Map();for(const r of httpEvidence?.receipts||[]){if(typeof r.file!=='string'||!/^evidence\/[a-z0-9._/-]+$/i.test(r.file)||r.file.split('/').includes('..')||files.has(r.file))throw Error('Unique confined Capital One evidence required');const bytes=await readEvidence(r.file);if(!Buffer.isBuffer(bytes))throw Error('Native evidence bytes required');files.set(r.file,Buffer.from(bytes))}
 const fixed=async file=>files.get(file),derived=await deriveCapitalOnePartialEvidence({source,httpEvidence,readEvidence:fixed,now}),trial=createCapitalOnePartialTrial(derived,httpEvidence),bytes=Buffer.from(JSON.stringify(trial,null,2)+'\n');const verified=await verifyCapitalOnePartialPublishingTrial({trial,bytes,readEvidence:fixed,now})
 fs.mkdirSync(directory);for(const[file,body]of files){const output=path.resolve(directory,file),relative=path.relative(directory,output);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Evidence path escapes frozen release');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,body,{flag:'wx'})}fs.writeFileSync(path.join(directory,'capitalone.json'),bytes,{flag:'wx'})
 return{source:'capitalone',file:'capitalone.json',trialByteHash:verified.trialByteHash,rawJobs:12,indiaJobs:null,eligibleJobs:12,companyGlobalTotal:null,companyIndiaTotal:null,sourceListingComplete:false,sourceDetailHealthComplete:false,productionWrites:false,evidenceFiles:files.size,replayEvidence:verified.replayEvidence}
}

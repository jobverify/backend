import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {ZEE_PARTIAL_CONTRACTS,deriveZeePartialEvidence,verifyZeePartialPublishingTrial} from './zeePartialPublishingEvidence.js'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const confinedFile=(directory,relative)=>{
 if(typeof relative!=='string'||path.isAbsolute(relative))throw new Error('Relative native archive path required')
 const file=fs.realpathSync(path.resolve(directory,relative)),rel=path.relative(directory,file)
 if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw new Error('Native path escapes archive')
 return file
}

// Copy exact reviewed public evidence offline. The original149-job trial stays
// intact; only110 eligible rows receive the current corporate persistence fields.
export async function freezeZeePartialTrial({nativeManifestFile,reviewFile,providerFile,outputDirectory,now=new Date()}){
 if(fs.existsSync(outputDirectory))throw new Error('Output directory already exists')
 const contract=ZEE_PARTIAL_CONTRACTS.zeeentertainmententerprises,nativePath=fs.realpathSync(nativeManifestFile),nativeDir=path.dirname(nativePath)
 const manifestBytes=fs.readFileSync(nativePath)
 if(hash(manifestBytes)!==contract.manifestSha256)throw new Error('Exact reviewed native manifest hash required')
 const manifest=JSON.parse(manifestBytes),bodies=new Map(),receipts=[]
 const add=(kind,file,bytes,extra={})=>{
  if(bodies.has(file))throw new Error('Duplicate evidence file')
  bodies.set(file,bytes);receipts.push({kind,file,bytes:bytes.length,sha256:hash(bytes),...extra})
 }
 add('capture-manifest','evidence/capture-manifest.json',manifestBytes)
 add('capture-trial','evidence/capture-trial.json',fs.readFileSync(confinedFile(nativeDir,manifest.trials[0].file)))
 add('independent-review','evidence/independent-review.json',fs.readFileSync(fs.realpathSync(reviewFile)))
 add('provider-extension','evidence/provider-extension.json',fs.readFileSync(fs.realpathSync(providerFile)))
 for(const receipt of manifest.receipts){
  const bytes=fs.readFileSync(confinedFile(nativeDir,receipt.file))
  if(hash(bytes)!==receipt.sha256)throw new Error('Original native capture file hash changed')
  add('native','evidence/native/'+receipt.file,bytes,{originFile:receipt.file})
 }
 for(const code of manifest.sourceHashes){
  if(!['scraper/zeeentertainmententerprises/native.js','scraper/zeeentertainmententerprises/script.js'].includes(code.file))throw new Error('Unexpected source file')
  add('source-code','evidence/source/'+code.file,fs.readFileSync(path.join(backend,code.file)),{sourcePath:code.file})
 }
 const httpEvidence={mode:'reviewed-zee-sensehq-exact-native-capture',receipts},readEvidence=async file=>bodies.get(file)
 const derived=await deriveZeePartialEvidence({source:'zeeentertainmententerprises',httpEvidence,readEvidence,now})
 const trial={schemaVersion:1,source:'zeeentertainmententerprises',mode:'native-http-partial-positive-trial',outcome:'positive-extraction-incomplete-evidence',productionWrites:false,
  attemptedAt:derived.startedAt,completedAt:derived.capturedAt,httpEvidence,rawJobs:149,indiaJobs:149,globalTotal:149,observedSelectedIndia:110,
  inventoryEvidence:derived.inventoryEvidence,observedSurfaceEvidence:derived.observedSurfaceEvidence,bindingEvidence:derived.bindingEvidence,
  detailHealth:derived.detailHealth,selectedDetailHealth:derived.selectedDetailHealth,filterCounts:derived.filterCounts,originalCapture:derived.originalCapture,jobs:derived.jobs}
 const bytes=Buffer.from(JSON.stringify(trial,null,2)+'\n'),verified=await verifyZeePartialPublishingTrial({trial,bytes,readEvidence,now})
 fs.mkdirSync(outputDirectory)
 for(const [relative,data]of bodies){const target=path.join(outputDirectory,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data,{flag:'wx'})}
 const file=path.join(outputDirectory,'zeeentertainmententerprises.json');fs.writeFileSync(file,bytes,{flag:'wx'})
 const receipt={source:trial.source,file,trialByteHash:verified.trialByteHash,productionWrites:false,rawTotal:149,indiaTotal:149,eligibleJobs:110,
  nativeInventoryComplete:true,inventoryComplete:false,detailHealth:derived.detailHealth,selectedDetailHealth:derived.selectedDetailHealth,
  attemptedAt:derived.startedAt,completedAt:derived.capturedAt,originalCapture:derived.originalCapture,frozenAt:now.toISOString()}
 fs.writeFileSync(path.join(outputDirectory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'})
 const release={schemaVersion:1,mode:'reviewed-zee-partial-positive-manifest',productionWrites:false,inventoryComplete:false,
  sources:[{source:trial.source,file:path.basename(file),trialByteHash:verified.trialByteHash,eligibleJobs:110}]}
 const manifestFile=path.join(outputDirectory,'manifest.json');fs.writeFileSync(manifestFile,JSON.stringify(release,null,2)+'\n',{flag:'wx'})
 return {...receipt,manifestFile,manifestSha256:hash(fs.readFileSync(manifestFile))}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]}
 if(!option('--native-manifest')||!option('--review')||!option('--provider')||!option('--output'))throw new Error('--native-manifest, --review, --provider and unused --output required')
 console.log(JSON.stringify(await freezeZeePartialTrial({nativeManifestFile:option('--native-manifest'),reviewFile:option('--review'),providerFile:option('--provider'),outputDirectory:path.resolve(option('--output'))})))
}

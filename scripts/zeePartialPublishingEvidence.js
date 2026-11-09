import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads'
import {analyzePublishableJobs} from '../scraper-support/utils/publishableJobMetrics.js'
import {hasSourceDescription} from '../src/utils/jobSourceContent.js'

// This release exception accepts the reviewed005 bytes only. A later capture or
// changed source implementation requires a separately reviewed contract.
export const ZEE_PARTIAL_CONTRACTS=Object.freeze({
 zeeentertainmententerprises:Object.freeze({companyName:'Zee Entertainment Enterprises Limited',companyDomain:'zee.com',
  careersUrl:'https://www.zee.com/careers/',listingUrl:'https://zee.sensehq.com/careers/jobs',organizationId:5045,
  manifestSha256:'f13e862f5a6fb09bf67dc542828f99faedd9c89e23a12a5c5073ce6c28378f33',
  trialSha256:'b2dd3de3a88f8b8e7ff07b82c1aafc577afcdbb08476aafccc66380a88f2a6cc',
  reviewSha256:'dfe82924da32c1d7d48a39d4a07ef803d42c9a33b0181e6665f4cf385607f30a',
  providerSha256:'114d68048d7c734ce7f0efc619df1f1f2871b7190ee342471740d60116de5913'})
})
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const proof=(ok,message)=>{if(!ok)throw new Error('ZEE partial proof: '+message)}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
 ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const fresh=(value,now)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=+now&&+now-Date.parse(value)<=48*3600000
const stableJobs=jobs=>jobs.map(({scrapedAt,...job})=>job)
const stableInventory=value=>Object.fromEntries(Object.entries(value||{}).filter(([key])=>key!=='verifiedAt'))

function isolatedReplay(packets,completedAt){
 return new Promise((resolve,reject)=>{
  // The offline worker has its own entry file; parent --input-type/--eval
  // entry flags do not apply to it. It makes no requests requiring TLS flags.
  const worker=new Worker(new URL(import.meta.url),{workerData:{kind:'reviewed-zee-offline-replay',packets,completedAt},execArgv:[],stdout:true,stderr:true})
  worker.stdout.on('data',()=>{});worker.stderr.on('data',()=>{})
  let settled=false
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(result)}
  const timer=setTimeout(()=>finish(new Error('ZEE offline replay deadline exceeded')),60000)
  worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!settled)finish(new Error('ZEE replay exited without proof: '+code))})
  worker.on('message',message=>message.error?finish(new Error(message.error)):finish(null,message.result))
 })
}

export async function deriveZeePartialEvidence({source,httpEvidence,readEvidence,now=new Date()}){
 proof(Object.hasOwn(ZEE_PARTIAL_CONTRACTS,source),'unsupported exact source')
 const contract=ZEE_PARTIAL_CONTRACTS[source],receipts=httpEvidence?.receipts
 proof(httpEvidence?.mode==='reviewed-zee-sensehq-exact-native-capture'&&Array.isArray(receipts)&&receipts.length===173
  &&new Set(receipts.map(r=>r.file)).size===receipts.length,'all unique reviewed evidence receipts required')
 const grouped=new Map()
 for(const receipt of receipts){
  proof(['capture-manifest','capture-trial','independent-review','provider-extension','native','source-code'].includes(receipt.kind),'unexpected evidence kind')
  proof(typeof receipt.file==='string'&&/^evidence\/[a-z0-9._/-]+$/i.test(receipt.file)&&!receipt.file.split('/').includes('..'),'confined relative evidence path required')
  const bytes=await readEvidence(receipt.file)
  proof(Buffer.isBuffer(bytes)&&bytes.length===receipt.bytes&&hash(bytes)===receipt.sha256,'evidence bytes/hash mismatch')
  if(!grouped.has(receipt.kind))grouped.set(receipt.kind,[])
  grouped.get(receipt.kind).push({receipt,bytes})
 }
 const single=(kind,expected)=>{const entries=grouped.get(kind);proof(entries?.length===1&&entries[0].receipt.sha256===expected,'exact reviewed '+kind+' hash required');return JSON.parse(entries[0].bytes)}
 const manifest=single('capture-manifest',contract.manifestSha256),original=single('capture-trial',contract.trialSha256),review=single('independent-review',contract.reviewSha256)
 const providerRecords=single('provider-extension',contract.providerSha256),providerRecord=providerRecords.find(p=>p.source===source)
 proof(manifest.productionWrites===false&&manifest.databaseAccessDisabled===true&&manifest.trials?.length===1
  &&manifest.trials[0].source===source&&manifest.trials[0].sha256===contract.trialSha256,'reviewed native manifest identity mismatch')
 proof(original.source===source&&original.mode==='isolated-direct-live-extraction-no-database'&&original.productionWrites===false
  &&original.outcome==='positive-extraction-incomplete-evidence'&&fresh(original.attemptedAt,now)&&fresh(original.completedAt,now)
  &&Date.parse(original.completedAt)>=Date.parse(original.attemptedAt),'fresh original capture window required')
 proof(review.reviewStatus==='clear-partial-description-health-retained'&&fresh(review.checkedAt,now)
  &&review.remainingConfirmedBlockers?.length===0&&review.current?.globalNativeRecords===149&&review.current.eligibleFullDescriptions===110,'exact fresh independent review required')
 const codes=grouped.get('source-code')||[]
 proof(codes.length===2&&manifest.sourceHashes?.length===2&&new Set(codes.map(c=>c.receipt.sourcePath)).size===2,'both reviewed source copies required')
 for(const c of codes){
  const expected=manifest.sourceHashes.find(row=>row.file===c.receipt.sourcePath)
  proof(expected&&expected.sha256===c.receipt.sha256&&['scraper/zeeentertainmententerprises/native.js','scraper/zeeentertainmententerprises/script.js'].includes(expected.file),'reviewed extraction code mismatch')
  proof(hash(fs.readFileSync(path.join(backend,expected.file)))===expected.sha256,'current source differs from reviewed capture')
 }
 const native=grouped.get('native')||[],packets=[]
 proof(native.length===167&&manifest.receipts?.length===167&&new Set(native.map(r=>r.receipt.originFile)).size===167,'all167 exact native runtime packets required')
 for(const entry of native){
  const expected=manifest.receipts.find(r=>r.file===entry.receipt.originFile),p=JSON.parse(entry.bytes)
  proof(expected&&expected.sha256===entry.receipt.sha256&&expected.bytes===entry.bytes.length&&p.source===source&&p.method==='GET'
   &&p.status===200&&expected.status===200&&p.url===expected.url&&p.finalURL===p.url&&p.finalURL===expected.finalURL
   &&typeof p.body==='string'&&hash(Buffer.from(p.body))===p.bodySha256&&p.bodySha256===expected.bodySha256
   &&fresh(p.startedAt,now)&&fresh(p.completedAt,now)&&Date.parse(p.completedAt)>=Date.parse(p.startedAt)
   &&Date.parse(p.startedAt)>=Date.parse(original.attemptedAt)&&Date.parse(p.completedAt)<=Date.parse(original.completedAt),'fresh successful exact native packet required')
  proof(typeof p.url==='string'&&(p.url==='https://www.zee.com/about-us/'||p.url===contract.careersUrl
   ||/^https:\/\/zee\.sensehq\.com\/careers\/jobs(?:\?page=\d+|\/[1-9]\d*)?$/.test(p.url)),'native origin or route mismatch')
  packets.push(p)
 }
 const official=native.find(e=>JSON.parse(e.bytes).url===contract.careersUrl)
 proof(providerRecords.length===1&&providerRecord?.bindingEvidence?.verified===true
  &&providerRecord.bindingEvidence.httpProofSha256===official.receipt.sha256&&fresh(providerRecord.bindingEvidence.checkedAt,now),'reviewed corporate handoff proof required')
 const {getScraperCatalog}=await import('../scraper-support/providers/index.js')
 const provider=getScraperCatalog().find(p=>p.source===source)
 proof(provider?.adapter==='script'&&provider.atsPlatform==='sensehq'&&provider.companyName===contract.companyName
  &&provider.companyDomain===contract.companyDomain&&provider.companyCareerPage===contract.careersUrl
  &&provider.backfillMode==='live-parser'&&provider.zeroResultPolicy==='evidence-required'
  &&provider.bindingEvidence?.verified===true&&provider.bindingEvidence.httpProofSha256===providerRecord.bindingEvidence.httpProofSha256
  &&path.resolve(provider.modulePath)===path.join(backend,'scraper/zeeentertainmententerprises/script.js'),'current provider identity differs from reviewed metadata')
 proof(original.rawJobs===149&&original.extractedJobs===149&&original.indiaJobs===149&&original.eligibleJobs===110
  &&Array.isArray(original.jobs)&&original.jobs.length===149&&new Set(original.jobs.map(j=>j.jobId)).size===149,'original complete149 record enumeration required')
 proof(original.inventoryEvidence?.firstParty===true&&original.inventoryEvidence.listingComplete===true
  &&original.inventoryEvidence.status==='complete-inventory'&&original.inventoryEvidence.pagesFetched===15
  &&original.inventoryEvidence.reportedTotal===149&&original.inventoryEvidence.indiaFacetCount===149,'original native enumeration must remain complete and separate')
 proof(original.jobs.every(j=>j.source===source&&j.company===contract.companyName&&j.country==='India'
  &&j.sourceListingComplete===false&&j.sourceNativeOrganizationId===5045&&j.sourceGlobalJobCount===149
  &&typeof j.jobId==='string'&&/^[1-9]\d*$/.test(j.jobId)&&j.sourceUrl===contract.listingUrl+'/'+j.jobId
  &&j.applyUrl===j.sourceUrl&&j.link===j.sourceUrl&&j.closingDate===null&&Number.isFinite(Date.parse(j.postedAt))&&Date.parse(j.postedAt)<=+now),'native India identity/partial flags changed')
 const missing=original.jobs.filter(j=>j.sourceDetailComplete!==true)
 proof(missing.length===39&&missing.every(j=>j.sourceDetailComplete===false&&j.sourceDetailFailureKind==='missing-content'
  &&j.sourceDescription===''&&j.jobDescription===''),'only39 actual empty native descriptions may be incomplete')
 const replay=await isolatedReplay(packets,original.completedAt)
 proof(replay.requestsUsed===167&&canonical(stableJobs(replay.jobs))===canonical(stableJobs(original.jobs)),'all original native job fields must match exact isolated replay')
 proof(canonical(stableInventory(replay.inventoryEvidence))===canonical(stableInventory(original.inventoryEvidence)),'original complete enumeration differs on replay')
 const analysis=analyzePublishableJobs(original.jobs,{now})
 proof(analysis.indiaJobs.length===149&&analysis.eligibleJobs.length===110&&analysis.eligibleJobs.every(j=>j.sourceDetailComplete===true&&hasSourceDescription(j))
  &&canonical(analysis.filterCounts)===canonical(original.filterCounts)&&analysis.filterCounts.emptyDescription===39,'all and only110 jobs must remain eligible with exact39 rejections')
 const jobs=analysis.eligibleJobs.map(job=>({...job,companyDomain:provider.companyDomain,companyCareerPage:provider.companyCareerPage}))
 const inventoryEvidence={...original.inventoryEvidence,status:'coverage-gap',listingComplete:false,
  reason:'native-zee-listing-complete-required-description-health-incomplete'}
 return {jobs,startedAt:original.attemptedAt,capturedAt:original.completedAt,rawTotal:149,publicTotal:149,indiaTotal:149,pagesFetched:15,listingUrl:contract.listingUrl,
  inventoryEvidence,observedSurfaceEvidence:original.inventoryEvidence,detailHealth:original.detailHealth,
  selectedDetailHealth:{complete:true,inspectedJobs:110,incompleteJobs:0,missingDescriptions:0,failureKinds:{}},filterCounts:original.filterCounts,
  bindingEvidence:{source,companyName:contract.companyName,companyDomain:contract.companyDomain,careersUrl:contract.careersUrl,listingUrl:contract.listingUrl,
   nativeOrganizationId:5045,nativeTenant:'zee',verifiedAt:providerRecord.bindingEvidence.checkedAt,corporateProofSha256:official.receipt.sha256,independentReviewSha256:contract.reviewSha256},
  originalCapture:{manifestSha256:contract.manifestSha256,trialSha256:contract.trialSha256,attemptedAt:original.attemptedAt,completedAt:original.completedAt,
   bytesPreserved:true,originalNativeRecords:149,originalMissingDescriptions:39,providerMetadataAddedFields:['companyDomain','companyCareerPage']},
  replayEvidence:{mode:'isolated-offline-exact-native-response-replay-no-network-no-database',requestsUsed:167,observedNativeJobs:149,selectedJobs:110}}
}

export async function verifyZeePartialPublishingTrial({trial,bytes,readEvidence,now=new Date()}){
 proof(Buffer.isBuffer(bytes)&&canonical(JSON.parse(bytes))===canonical(trial),'trial differs from exact bytes')
 proof(Object.hasOwn(ZEE_PARTIAL_CONTRACTS,trial?.source)&&trial.schemaVersion===1&&trial.mode==='native-http-partial-positive-trial'
  &&trial.outcome==='positive-extraction-incomplete-evidence'&&trial.productionWrites===false&&trial.success!==true&&trial.extractionComplete!==true
  &&trial.maxJobs==null&&trial.truncated!==true&&trial.rawJobs===149&&trial.indiaJobs===149&&trial.globalTotal===149&&trial.observedSelectedIndia===110,'untruncated partial publication with truthful149-record scope required')
 const derived=await deriveZeePartialEvidence({source:trial.source,httpEvidence:trial.httpEvidence,readEvidence,now})
 proof(trial.attemptedAt===derived.startedAt&&trial.completedAt===derived.capturedAt,'original captured timestamps must be preserved')
 for(const field of ['inventoryEvidence','observedSurfaceEvidence','bindingEvidence','detailHealth','selectedDetailHealth','filterCounts','originalCapture'])
  proof(canonical(trial[field])===canonical(derived[field]),field+' differs from exact native proof')
 proof(Array.isArray(trial.jobs)&&canonical(trial.jobs)===canonical(derived.jobs),'every and only eligible native job must retain its original fields and partial flags')
 return {...derived,trial,trialByteHash:hash(bytes),eligibleJobs:110}
}

if(!isMainThread&&workerData?.kind==='reviewed-zee-offline-replay'){
 const replay=async()=>{
  const {packets,completedAt}=workerData,used=new Set()
  globalThis.fetch=async(input,init={})=>{
   const url=String(input),method=init.method||'GET',index=packets.findIndex((p,i)=>!used.has(i)&&p.url===url&&p.method===method)
   proof(index>=0,'uncaptured or repeated native request');used.add(index)
   const p=packets[index],response=new Response(p.body,{status:p.status,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:p.finalURL});return response
  }
  const {run}=await import('../scraper/zeeentertainmententerprises/script.js')
  const {readInventoryEvidence}=await import('../scraper-support/utils/inventoryEvidence.js')
  const jobs=await run({now:()=>completedAt,signal:AbortSignal.timeout(55000)})
  proof(used.size===packets.length,'unused native runtime packet')
  return {jobs,inventoryEvidence:readInventoryEvidence(jobs),requestsUsed:used.size}
 }
 replay().then(result=>parentPort.postMessage({result}),error=>parentPort.postMessage({error:error.message}))
}

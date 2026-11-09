import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { hasSourceDescription } from '../src/utils/jobSourceContent.js'
import { WORKDAY_REREVIEW_MODE, deriveWorkdayPartialRereviewEvidence, verifyWorkdayPartialRereviewTrial } from './workdayPartialRereviewEvidence.js'

// Release022 is an exception for these independently reviewed captures only.
// New captures or changed extraction code require a new reviewed contract.
export const WORKDAY_PARTIAL_CONTRACTS = Object.freeze({
  blackrock: Object.freeze({ companyName:'BlackRock',companyDomain:'blackrock.com',careersUrl:'https://careers.blackrock.com/search-jobs',
    origin:'https://blackrock.wd1.myworkdayjobs.com',tenant:'blackrock',site:'BlackRock_Professional',selectedIndia:42,
    manifestSha256:'3f7b9cd1247d8985f03b02a71cf901de80ba12afcafd931d8339c06998592156',
    trialSha256:'4f711f5d6d56a37cbf171cb124b631a82971de4e9df2058444328214660dba30' }),
  blackstone: Object.freeze({ companyName:'Blackstone',companyDomain:'blackstone.com',careersUrl:'https://www.blackstone.com/careers/careers-blackstone/',
    origin:'https://blackstone.wd1.myworkdayjobs.com',tenant:'blackstone',site:'Blackstone_Careers',selectedIndia:4,
    manifestSha256:'b6af0ac1894cb8990f7080935a4a9dbef96428d7881b1e9b8d6737a996d904ec',
    trialSha256:'89baccd69151201a511a4d9a81a68337aae84c1c9a4d3224e892d7792b92d2aa' }),
})
const DISCOVERY_SHA='84d794fa440c68e4ef3bdeecf5469199031fd36fd1fb9a8ea1c281868a13e4ec'
const REVIEW_SHA='9163e54a5169de3ac3e4e50ad02d5886ee285cf029b8f9bbe56a61217a4f4ab6'
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const proof=(ok,message)=>{if(!ok)throw new Error('Workday partial proof: '+message)}
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const fresh=(value,now)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=+now&&+now-Date.parse(value)<=48*3600000
const withoutScrapedAt=jobs=>jobs.map(({scrapedAt,...job})=>job)
const stableInventory=e=>Object.fromEntries(Object.entries(e||{}).filter(([key])=>key!=='verifiedAt'))

async function isolatedReplay(data){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{kind:'reviewed-workday-partial-offline-replay',...data},stdout:true,stderr:true})
    worker.stdout.on('data',()=>{});worker.stderr.on('data',()=>{})
    let settled=false
    const done=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(result)}
    const timer=setTimeout(()=>done(new Error('Workday offline replay deadline exceeded')),60000)
    worker.on('error',error=>done(error))
    worker.on('exit',code=>{if(!settled)done(new Error('Workday replay exited without proof: '+code))})
    worker.on('message',message=>message.error?done(new Error(message.error)):done(null,message.result))
  })
}

export async function deriveWorkdayPartialEvidence({source,httpEvidence,readEvidence,now=new Date()}){
  if(httpEvidence?.mode===WORKDAY_REREVIEW_MODE)return deriveWorkdayPartialRereviewEvidence({source,httpEvidence,readEvidence,now})
  proof(Object.hasOwn(WORKDAY_PARTIAL_CONTRACTS,source),'unsupported exact source')
  const contract=WORKDAY_PARTIAL_CONTRACTS[source],receipts=httpEvidence?.receipts
  proof(httpEvidence?.mode==='reviewed-workday-partial-exact-native-capture'&&Array.isArray(receipts)&&receipts.length>10&&receipts.length<500
    &&new Set(receipts.map(r=>r.file)).size===receipts.length,'unique reviewed native evidence receipts required')
  const grouped=new Map()
  for(const receipt of receipts){
    proof(['capture-manifest','capture-trial','independent-review','discovery','discovery-proof','native','source-code'].includes(receipt.kind),'unexpected evidence kind')
    proof(typeof receipt.file==='string'&&/^evidence\/[a-z0-9._/-]+$/i.test(receipt.file)&&!receipt.file.split('/').includes('..'),'confined relative evidence path required')
    const bytes=await readEvidence(receipt.file)
    proof(Buffer.isBuffer(bytes)&&bytes.length===receipt.bytes&&hash(bytes)===receipt.sha256,'evidence bytes/hash mismatch')
    if(!grouped.has(receipt.kind))grouped.set(receipt.kind,[])
    grouped.get(receipt.kind).push({receipt,bytes})
  }
  const single=(kind,expectedHash)=>{const list=grouped.get(kind);proof(list?.length===1&&list[0].receipt.sha256===expectedHash,'exact approved '+kind+' required');return JSON.parse(list[0].bytes)}
  const manifest=single('capture-manifest',contract.manifestSha256),original=single('capture-trial',contract.trialSha256),review=single('independent-review',REVIEW_SHA),discovery=single('discovery',DISCOVERY_SHA)
  proof(manifest.source===source&&manifest.mode==='captured-live-public-http-extraction-no-database'&&manifest.productionWrites===false
    &&manifest.trial.sha256===contract.trialSha256,'reviewed native capture identity mismatch')
  proof(original.source===source&&original.outcome==='extracted'&&original.mode===manifest.mode&&original.productionWrites===false
    &&fresh(original.attemptedAt,now)&&fresh(original.completedAt,now)&&Date.parse(original.completedAt)>=Date.parse(original.attemptedAt),'fresh original capture window required')
  proof(review.reviewStatus==='clear-with-explicit-partial-scope'&&fresh(review.checkedAt,now)
    &&review.sources.some(row=>row.source===source&&row.manifestSha256===contract.manifestSha256&&row.trialSha256===contract.trialSha256),'exact independent source review required')
  const record=discovery.records?.find(row=>row.source===source)
  proof(discovery.batchId==='batch-012'&&fresh(discovery.checkedAt,now)&&record&&fresh(record.checkedAt,now)
    &&record.officialCareerSurfaceVerified===true&&record.officialIdentityEvidenceStatus==='current-official-page'
    &&record.careersURL===contract.careersUrl&&record.ats?.kind==='workday'&&record.ats.token===contract.tenant&&record.ats.site===contract.site
    &&new URL(record.ats.verifiedNativeURL).origin===contract.origin,'current exact official company/native binding required')
  const discoveryProofs=grouped.get('discovery-proof')||[]
  proof(discoveryProofs.length===record.proofFiles.length&&new Set(discoveryProofs.map(r=>r.receipt.proofPath)).size===discoveryProofs.length
    &&record.proofFiles.every(file=>{const expected=discovery.proofIntegrity.find(r=>r.path===file),actual=discoveryProofs.find(r=>r.receipt.proofPath===file);return actual&&expected&&actual.receipt.sha256===expected.sha256&&actual.receipt.bytes===expected.bytes}),'original reviewed official proof files required')
  const codes=grouped.get('source-code')||[]
  proof(Array.isArray(manifest.codeReceipts)&&codes.length===manifest.codeReceipts.length
    &&new Set(codes.map(c=>c.receipt.sourcePath)).size===codes.length,'exact captured source/config copies required')
  for(const entry of codes){
    const expected=manifest.codeReceipts.find(c=>c.file===entry.receipt.sourcePath)
    proof(expected&&expected.sha256===entry.receipt.sha256&&expected.frozenCopy.sha256===expected.sha256,'captured extraction code hash mismatch')
    const current=path.resolve(repoRoot,expected.file),relative=path.relative(path.join(repoRoot,'jobverify-backend'),current)
    proof(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&hash(fs.readFileSync(current))===expected.sha256,'current extraction/config code differs from reviewed native replay')
  }
  const native=grouped.get('native')||[],packets=[]
  proof(native.length===manifest.receipts.length&&new Set(native.map(r=>r.receipt.originFile)).size===native.length,'every exact original runtime response required')
  for(const entry of native){
    const expected=manifest.receipts.find(r=>r.file===entry.receipt.originFile),packet=JSON.parse(entry.bytes)
    proof(expected&&expected.sha256===entry.receipt.sha256&&expected.bytes===entry.bytes.length&&packet.status===200&&expected.status===200
      &&typeof packet.body==='string'&&hash(Buffer.from(packet.body))===packet.bodySha256&&packet.bodySha256===expected.bodySha256
      &&packet.url===expected.url&&packet.method===expected.method&&fresh(packet.startedAt,now)&&fresh(packet.checkedAt,now)
      &&Date.parse(packet.checkedAt)>=Date.parse(packet.startedAt)&&Date.parse(packet.startedAt)>=Date.parse(original.attemptedAt)
      &&Date.parse(packet.checkedAt)<=Date.parse(original.completedAt),'successful fresh exact native packet required')
    const url=new URL(packet.url),allowed=[contract.origin,...(source==='blackrock'?['https://careers.blackrock.com','https://blackrock.tal.net']:[])]
    proof(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&allowed.includes(url.origin),'native origin or identity mismatch')
    packets.push(packet)
  }
  proof(Array.isArray(original.jobs)&&original.jobs.length===contract.selectedIndia&&original.eligibleJobs===contract.selectedIndia
    &&original.inventoryEvidence?.status==='coverage-gap'&&original.inventoryEvidence.listingComplete===false
    &&original.inventoryEvidence.firstParty===true&&original.inventoryEvidence.reportedTotal===null&&original.inventoryEvidence.indiaFacetCount===null
    &&original.detailHealth?.complete===false&&original.detailHealth.missingDescriptions===0,'original partial inventory must remain incomplete with unknown company counts')
  const replay=await isolatedReplay({source,packets,provider:manifest.provider,completedAt:original.completedAt})
  proof(replay.requestsUsed===packets.length&&canonical(withoutScrapedAt(replay.jobs))===canonical(withoutScrapedAt(original.jobs)))
  proof(canonical(stableInventory(replay.inventoryEvidence))===canonical(stableInventory(original.inventoryEvidence)),'replayed partial inventory differs from original')
  proof(original.jobs.every(job=>job.source===source&&job.company===contract.companyName&&job.companyDomain===contract.companyDomain
    &&job.companyCareerPage===contract.careersUrl&&job.country==='India'&&job.sourceListingComplete===false&&job.sourceDetailComplete===true
    &&job.sourceGlobalJobCount===null&&typeof job.jobId==='string'&&job.jobId===job.requisitionId&&hasSourceDescription(job)
    &&job.sourceClosingDateIsExact===false),'every selected job needs exact native identity/content/India scope and original partial flags')
  const analysis=analyzePublishableJobs(original.jobs,{now})
  proof(analysis.eligibleJobs.length===original.jobs.length,'every selected native role must remain eligible now')
  return {jobs:original.jobs,startedAt:original.attemptedAt,capturedAt:original.completedAt,rawTotal:null,publicTotal:null,indiaTotal:null,
    inventoryEvidence:original.inventoryEvidence,detailHealth:original.detailHealth,
    selectedDetailHealth:{complete:true,inspectedJobs:original.jobs.length,incompleteJobs:0,missingDescriptions:0,failureKinds:{}},
    filterCounts:{nonIndia:null,invalidUrl:null,emptyDescription:null,closed:null,nonJob:null,old:null},
    bindingEvidence:{source,companyName:contract.companyName,companyDomain:contract.companyDomain,careersUrl:contract.careersUrl,
      workdayOrigin:contract.origin,nativeSite:contract.site,verifiedAt:record.checkedAt,discoverySha256:DISCOVERY_SHA,independentReviewSha256:REVIEW_SHA},
    originalCapture:{manifestSha256:contract.manifestSha256,trialSha256:contract.trialSha256,attemptedAt:original.attemptedAt,completedAt:original.completedAt,bytesPreserved:true},
    replayEvidence:{requestsUsed:replay.requestsUsed,selectedJobs:original.jobs.length,mode:'isolated-offline-exact-native-response-replay-no-network-no-database'}}
}

export async function verifyWorkdayPartialPublishingTrial({trial,bytes,readEvidence,now=new Date()}){
  if(trial?.httpEvidence?.mode===WORKDAY_REREVIEW_MODE)return verifyWorkdayPartialRereviewTrial({trial,bytes,readEvidence,now})
  proof(Buffer.isBuffer(bytes)&&canonical(JSON.parse(bytes))===canonical(trial),'trial differs from exact bytes')
  proof(Object.hasOwn(WORKDAY_PARTIAL_CONTRACTS,trial?.source)&&trial.schemaVersion===1&&trial.mode==='native-http-partial-positive-trial'
    &&trial.outcome==='positive-extraction-incomplete-evidence'&&trial.productionWrites===false&&trial.maxJobs==null&&trial.truncated!==true
    &&trial.rawJobs===null&&trial.indiaJobs===null&&trial.globalTotal===null,'untruncated partial trial with unknown company counts required')
  const derived=await deriveWorkdayPartialEvidence({source:trial.source,httpEvidence:trial.httpEvidence,readEvidence,now})
  proof(trial.attemptedAt===derived.startedAt&&trial.completedAt===derived.capturedAt,'original captured trial timestamps must be preserved')
  for(const field of ['inventoryEvidence','bindingEvidence','detailHealth','selectedDetailHealth','filterCounts','originalCapture'])proof(canonical(trial[field])===canonical(derived[field]),field+' differs from exact native proof')
  proof(trial.observedSelectedIndia===derived.jobs.length&&canonical(trial.jobs)===canonical(derived.jobs),'every and only selected native job/content field must match original capture')
  return {...derived,trial,trialByteHash:hash(bytes),eligibleJobs:derived.jobs.length}
}

if(!isMainThread&&workerData?.kind==='reviewed-workday-partial-offline-replay'){
  const run=async()=>{
    const {source,packets,provider,completedAt}=workerData
    proof(Object.hasOwn(WORKDAY_PARTIAL_CONTRACTS,source),'unsupported offline source')
    const used=new Set()
    globalThis.fetch=async(input,init={})=>{
      const url=String(input),method=init.method||'GET',body=init.body||null
      const index=packets.findIndex((p,i)=>!used.has(i)&&p.url===url&&p.method===method&&(p.requestBody||null)===body)
      proof(index>=0,'uncaptured or repeated native request')
      used.add(index);const packet=packets[index],response=new Response(packet.body,{status:packet.status,headers:{'Content-Type':packet.contentType||'text/html'}})
      Object.defineProperty(response,'url',{value:packet.finalURL});return response
    }
    const {run}=await import(new URL('../scraper/'+source+'.workday/script.js',import.meta.url))
    const {decorateJobsWithProviderMetadata}=await import('../scraper-support/providers/index.js')
    const {readInventoryEvidence}=await import('../scraper-support/utils/inventoryEvidence.js')
    const jobs=decorateJobsWithProviderMetadata(await run({signal:AbortSignal.timeout(55000),requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0},
      requestTimeoutMs:1000,retryBaseDelayMs:0,now:()=>completedAt}),provider)
    proof(used.size===packets.length,'unused captured native response')
    return {jobs,inventoryEvidence:readInventoryEvidence(jobs),requestsUsed:used.size}
  }
  run().then(result=>parentPort.postMessage({result}),error=>parentPort.postMessage({error:error.message}))
}

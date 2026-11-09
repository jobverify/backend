import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { Worker,isMainThread,parentPort,workerData } from 'node:worker_threads'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'

// Only this independently reviewed capture qualifies. A changed capture or
// extraction contract needs a new review; this does not accept other tenants.
export const NAVI_PARTIAL_CONTRACTS=Object.freeze({navi:Object.freeze({
 source:'navi',companyName:'Navi',domain:'navi.com',careers:'https://navi.com/careers',origin:'https://navi.turbohire.co',
 orgId:'3e818601-0baa-429c-b6f8-4b21903ae0e6',board:'https://navi.turbohire.co/dashboardv2?orgId=3e818601-0baa-429c-b6f8-4b21903ae0e6&type=0',
 releaseSha256:'bffe0f7342f5504e429ea11a525e6aac49ecc3c83cadc6c0d493b17b461935eb',
 manifestSha256:'5d91a4c7701809cb2fe03175aa7f7936a7d2f4c3023310c96e955547ff8ee2e6',
 captureTrialSha256:'6aad3ce36c05b87f84c54e7f7bbb178fc68f208a72613d8b0cc129f03aa50901',
 catalogTrialSha256:'599faecade5a0dc41a751f3ce74cc1689787124b753bb680d183f4ebeff27d14',
 officialProofSha256:'1d9800bab0f439557eefbbf5763081b41b96c8968d4b34705cbebb37f3f88604',
 reviewedReplaySha256:'8206bfb4563e48d215f66e9a0adca0229f148c73cd2122019c421f6e5e57bcad',
 independentReviewSha256:'ccb44f49b5ebf281da1f2b6c8f30dfa3aedf5e50bee90ffdbd371f51ece5e345',
})})
const contract=NAVI_PARTIAL_CONTRACTS.navi,backendRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const TOKEN='https://thapi.azurewebsites.net/api/token/noauth',API='https://thapi.azurewebsites.net'
const sha=b=>createHash('sha256').update(b).digest('hex'),proof=(ok,message)=>{if(!ok)throw Error('Navi partial proof: '+message)}
const canonical=v=>JSON.stringify(v,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const fresh=(s,now)=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&Date.parse(s)<=+now&&+now-Date.parse(s)<=48*3600000
const stableJobs=jobs=>jobs.map(({scrapedAt,...job})=>job),stableInventory=e=>Object.fromEntries(Object.entries(e).filter(([key])=>key!=='verifiedAt'))
const withoutCatalog=jobs=>jobs.map(({companyDomain,companyCareerPage,atsPlatform,...job})=>job)
const replay=packets=>new Promise((resolve,reject)=>{
 const worker=new Worker(new URL(import.meta.url),{workerData:{kind:'navi-reviewed-partial-offline-replay',packets},stdout:true,stderr:true});worker.stdout.on('data',()=>{});worker.stderr.on('data',()=>{})
 let settled=false
 const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(result)}
 const timer=setTimeout(()=>finish(Error('Navi offline replay deadline exceeded')),60000)
 worker.on('error',e=>finish(e));worker.on('exit',code=>{if(!settled)finish(Error('Navi replay exited without proof: '+code))});worker.on('message',m=>m.error?finish(Error(m.error)):finish(null,m.result))
})

export async function deriveNaviPartialEvidence({source,httpEvidence,readEvidence,now=new Date()}){
 proof(source==='navi','unsupported exact source')
 const receipts=httpEvidence?.receipts
 proof(httpEvidence?.mode==='reviewed-navi-native-partial-exact-capture'&&Array.isArray(receipts)&&receipts.length>43&&receipts.length<100&&new Set(receipts.map(r=>r.file)).size===receipts.length,'unique exact evidence receipts required')
 const groups=new Map()
 for(const r of receipts){
  proof(['original-release','capture-manifest','capture-trial','catalog-trial','official-proof','reviewed-replay','independent-review','attachment-proof','attachment-body','native','official-http','current-code'].includes(r.kind),'unknown evidence kind')
  proof(typeof r.file==='string'&&/^evidence\/[a-z0-9._/-]+$/i.test(r.file)&&!r.file.split('/').includes('..'),'confined relative evidence file required')
  const bytes=await readEvidence(r.file);proof(Buffer.isBuffer(bytes)&&bytes.length===r.bytes&&sha(bytes)===r.sha256,'evidence bytes/hash mismatch')
  if(!groups.has(r.kind))groups.set(r.kind,[]);groups.get(r.kind).push({r,bytes})
 }
 const single=(kind,expected)=>{const list=groups.get(kind);proof(list?.length===1&&(!expected||list[0].r.sha256===expected),'exact reviewed '+kind+' required');return JSON.parse(list[0].bytes)}
 const release=single('original-release',contract.releaseSha256),manifest=single('capture-manifest',contract.manifestSha256),captured=single('capture-trial',contract.captureTrialSha256),original=single('catalog-trial',contract.catalogTrialSha256),official=single('official-proof',contract.officialProofSha256),reviewed=single('reviewed-replay',contract.reviewedReplaySha256),independent=single('independent-review',contract.independentReviewSha256)
 proof(release.productionWrites===false&&release.trials.length===1&&release.trials[0].source==='navi'&&release.trials[0].trialSha256===contract.catalogTrialSha256,'original release source mismatch')
 proof(manifest.source==='navi'&&manifest.productionWrites===false&&Array.isArray(manifest.receipts)&&manifest.receipts.length===43,'exact original native capture required')
 proof(captured.source==='navi'&&captured.mode==='captured-live-public-http-extraction-no-database'&&captured.productionWrites===false&&captured.outcome==='positive-extraction-incomplete-details','native capture provenance mismatch')
 proof(original.source==='navi'&&original.mode==='isolated-direct-live-extraction-no-database'&&original.productionWrites===false&&original.outcome==='positive-extraction-incomplete-evidence','original catalog trial provenance mismatch')
 for(const t of [captured,original])proof(fresh(t.attemptedAt,now)&&fresh(t.completedAt,now)&&Date.parse(t.completedAt)>=Date.parse(t.attemptedAt),'fresh original capture/catalog window required')
 proof(independent.reviewStatus==='clear-with-explicit-missing-native-descriptions'&&independent.source==='navi'&&independent.productionWrites===false&&independent.databaseReadOrWrite===false&&fresh(independent.checkedAt,now),'fresh corrected independent parser review required')
 proof(independent.originalRelease.sha256===contract.releaseSha256&&independent.originalFrozenTrial.sha256===contract.catalogTrialSha256&&independent.originalNativeCapture.sha256===contract.manifestSha256&&independent.currentCorrectedReplayAttestation.sha256===contract.reviewedReplaySha256,'independent review binding mismatch')
 proof(reviewed.source==='navi'&&reviewed.productionWrites===false&&fresh(reviewed.verifiedAt,now)&&reviewed.captureTrialSha256===contract.captureTrialSha256&&reviewed.frozenCatalogTrialSha256===contract.catalogTrialSha256&&reviewed.packetCount===43&&reviewed.rawBodyPacketsVerified===42&&reviewed.sourceDetailHealthComplete===false,'current corrected replay attestation mismatch')
 proof(canonical(reviewed.captureTimeCodeHashes)===canonical(manifest.codeHashes)&&canonical(reviewed.currentReviewedReplayCodeHashes)===canonical(independent.currentReviewedCode)&&canonical(manifest.codeHashes)!==canonical(reviewed.currentReviewedReplayCodeHashes),'historical capture and current corrected code provenance must remain separate')
 const codes=groups.get('current-code')||[]
 proof(codes.length===reviewed.currentReviewedReplayCodeHashes.length&&new Set(codes.map(c=>c.r.sourcePath)).size===codes.length,'all current reviewed code copies required')
 for(const c of codes){const expected=reviewed.currentReviewedReplayCodeHashes.find(e=>e.file===c.r.sourcePath);proof(expected&&expected.sha256===c.r.sha256,'current reviewed code copy mismatch');const current=path.resolve(backendRoot,expected.file),rel=path.relative(backendRoot,current);proof(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel)&&sha(fs.readFileSync(current))===expected.sha256,'current extraction code differs from corrected reviewed code')}
 proof(official.source==='navi'&&official.officialURL===contract.careers&&official.orgId===contract.orgId&&fresh(official.checkedAt,now)&&official.matchedLinks.length===1&&official.matchedLinks[0]===contract.board,'fresh exact official corporate/native binding required')
 const officialPackets=groups.get('official-http')||[]
 proof(officialPackets.length===official.receipts.length&&new Set(officialPackets.map(p=>p.r.originFile)).size===officialPackets.length,'every original official proof response required')
 for(const p of officialPackets){const expected=official.receipts.find(e=>e.file===p.r.originFile),packet=JSON.parse(p.bytes);proof(expected&&expected.sha256===p.r.sha256&&packet.status===200&&packet.url===expected.url&&packet.finalURL===packet.url&&typeof packet.body==='string'&&sha(packet.body)===expected.bodySha256&&fresh(packet.completedAt,now),'official response identity/body/freshness mismatch')}
 const native=groups.get('native')||[],packets=[]
 proof(native.length===43&&new Set(native.map(p=>p.r.originFile)).size===43,'all43 original runtime responses required')
 let omitted=0,rawBodies=0
 for(const p of native){
  const expected=manifest.receipts.find(e=>e.file===p.r.originFile),packet=JSON.parse(p.bytes)
  proof(expected&&expected.sha256===p.r.sha256&&expected.url===packet.url&&expected.method===packet.method&&expected.status===200&&packet.status===200&&packet.finalURL===packet.url&&fresh(packet.completedAt,now)&&packet.bodySha256===expected.bodySha256,'successful exact fresh native response required')
  proof(Date.parse(packet.completedAt)>=Date.parse(captured.attemptedAt)&&Date.parse(packet.completedAt)<=Date.parse(captured.completedAt),'runtime packet outside original capture window')
  const u=new URL(packet.url);proof(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&['https://navi.com',contract.origin,API].includes(u.origin),'native origin mismatch')
  if(packet.url===TOKEN){proof(packet.method==='GET'&&packet.body===undefined&&Boolean(packet.rawBodyOmitted)&&/^[a-f0-9]{64}$/.test(packet.bodySha256),'anonymous credential body must stay explicitly omitted');omitted++}
  else{proof(typeof packet.body==='string'&&sha(packet.body)===packet.bodySha256&&!packet.rawBodyOmitted,'native response body mismatch');rawBodies++}
  packets.push(packet)
 }
 proof(omitted===1&&rawBodies===42,'exact anonymous omission and42 original bodies required')
 proof(Array.isArray(original.jobs)&&original.jobs.length===38&&original.rawJobs===38&&original.indiaJobs===38&&original.eligibleJobs===36&&original.inventoryEvidence?.listingComplete===true&&original.inventoryEvidence.reportedTotal===38&&original.inventoryEvidence.indiaFacetCount===38&&original.detailHealth?.complete===false&&original.detailHealth.missingDescriptions===2,'native38/healthy36/missing2 must remain distinct')
 const replayed=await replay(packets)
 proof(replayed.requestsUsed===43&&canonical(stableJobs(replayed.jobs))===canonical(stableJobs(original.jobs)),'current replay must equal all38 catalog-decorated original jobs')
 proof(canonical(stableJobs(captured.jobs))===canonical(stableJobs(withoutCatalog(original.jobs))),'all38 native job fields must equal original capture before the three explicit catalog decorations')
 proof(canonical(stableInventory(replayed.inventoryEvidence))===canonical(stableInventory(original.inventoryEvidence)),'complete native listing differs from original')
 const healthy=original.jobs.filter(j=>j.sourceDetailComplete===true),missing=original.jobs.filter(j=>j.sourceDetailComplete===false)
 proof(healthy.length===36&&missing.length===2&&missing.every(j=>!j.jobDescription)&&original.jobs.every(j=>j.source==='navi'&&j.company==='Navi'&&j.companyDomain===contract.domain&&j.companyCareerPage===contract.careers&&j.country==='India'&&j.sourceListingComplete===true),'native role identity/geography/content flags mismatch')
 const missingNativeDetails=missing.map(j=>({jobId:j.jobId,sourceUrl:j.sourceUrl,status:j.sourceDetailStatus,attachment:j.sourceDescriptionAttachment??null}))
 const attachment=single('attachment-proof'),bodies=groups.get('attachment-body')||[]
 proof(attachment.status===404&&attachment.url===attachment.finalURL&&fresh(attachment.completedAt,now)&&bodies.length===1&&sha(bodies[0].bytes)===attachment.sha256&&bodies[0].bytes.length===attachment.bytes&&missingNativeDetails.some(j=>j.attachment===attachment.url),'exact observed missing attachment404 proof required')
 const analysis=analyzePublishableJobs(original.jobs,{now})
 proof(analysis.eligibleJobs.length===36&&canonical(analysis.filterCounts)===canonical(original.filterCounts),'all selected jobs must remain eligible and native missing2/filter counts must match')
 const jobs=healthy.map(j=>({...j,sourceListingComplete:false})),inventoryEvidence={...original.inventoryEvidence,status:'discovery-only',listingComplete:false,reason:'native-listing-complete38-selected36-healthy-details-partial-publication'}
 return{jobs,startedAt:original.attemptedAt,capturedAt:original.completedAt,rawTotal:38,publicTotal:38,indiaTotal:38,
  sourceNativeInventoryEvidence:original.inventoryEvidence,inventoryEvidence,detailHealth:original.detailHealth,
  selectedDetailHealth:{complete:true,inspectedJobs:36,incompleteJobs:0,missingDescriptions:0,failureKinds:{}},missingNativeDetails,filterCounts:original.filterCounts,
  bindingEvidence:{source:'navi',companyName:'Navi',companyDomain:contract.domain,careersUrl:contract.careers,boardUrl:contract.board,orgId:contract.orgId,verifiedAt:official.checkedAt,officialProofSha256:contract.officialProofSha256,independentReviewSha256:contract.independentReviewSha256,reviewedReplaySha256:contract.reviewedReplaySha256},
  originalCapture:{releaseSha256:contract.releaseSha256,manifestSha256:contract.manifestSha256,nativeTrialSha256:contract.captureTrialSha256,catalogTrialSha256:contract.catalogTrialSha256,
   nativeAttemptedAt:captured.attemptedAt,nativeCompletedAt:captured.completedAt,catalogAttemptedAt:original.attemptedAt,catalogCompletedAt:original.completedAt,
   captureTimeCodeHashes:manifest.codeHashes,currentReviewedCodeHashes:reviewed.currentReviewedReplayCodeHashes,originalJobTimestampsPreserved:true,
   derivedPublicationChange:'Select36 complete native descriptions and set only their sourceListingComplete flag false; no synthetic content or native field changes.'},
  replayEvidence:{runtimeResponsesUsed:43,rawResponseBodiesVerified:42,anonymousTokenBodyOmitted:true,explicitSyntheticOfflineTransportCredentialOnly:true,syntheticJobContent:false,all38NativeFieldsEqual:true,mode:'isolated-offline-exact-native-response-replay-no-network-no-database'}}
}

export async function verifyNaviPartialPublishingTrial({trial,bytes,readEvidence,now=new Date()}){
 proof(Buffer.isBuffer(bytes)&&canonical(JSON.parse(bytes))===canonical(trial),'trial differs from exact file bytes')
 proof(trial?.source==='navi'&&trial.schemaVersion===1&&trial.mode==='native-http-partial-positive-trial'&&trial.outcome==='positive-extraction-incomplete-evidence'&&trial.productionWrites===false&&trial.maxJobs==null&&trial.truncated!==true&&trial.rawJobs===38&&trial.indiaJobs===38&&trial.globalTotal===38,'exact untruncated partial trial with native38 required')
 const derived=await deriveNaviPartialEvidence({source:trial.source,httpEvidence:trial.httpEvidence,readEvidence,now})
 proof(trial.attemptedAt===derived.startedAt&&trial.completedAt===derived.capturedAt,'original catalog capture times must be preserved')
 for(const field of ['sourceNativeInventoryEvidence','inventoryEvidence','bindingEvidence','detailHealth','selectedDetailHealth','missingNativeDetails','filterCounts','originalCapture'])proof(canonical(trial[field])===canonical(derived[field]),field+' differs from reviewed proof')
 proof(trial.observedSelectedIndia===36&&canonical(trial.jobs)===canonical(derived.jobs),'every and only selected36 native jobs must match explicit partial derivation')
 return{...derived,trial,trialByteHash:sha(bytes),eligibleJobs:36}
}

if(!isMainThread&&workerData?.kind==='navi-reviewed-partial-offline-replay'){
 const execute=async()=>{
  globalThis.fetch=async()=>{throw Error('Navi offline proof forbids uncaptured network requests')}
  const {run,NOAUTH_TOKEN_URL}=await import('../scraper/navi/script.js'),{decorateJobsWithProviderMetadata,getScraperCatalog}=await import('../scraper-support/providers/index.js'),{readInventoryEvidence}=await import('../scraper-support/utils/inventoryEvidence.js')
  const packets=workerData.packets,used=new Set(),synthetic='navi-proof-explicit-offline-synthetic-public-transport-credential'
  const take=(url,options={})=>{const index=packets.findIndex((p,i)=>!used.has(i)&&p.url===url&&p.method===(options.method||'GET')&&(p.requestBody||null)===(options.body||null));proof(index>=0,'uncaptured or repeated request URL/method/body');if(url.startsWith(API)&&url!==NOAUTH_TOKEN_URL)proof(options.headers?.Authorization==='Bearer '+synthetic,'explicit synthetic offline credential required');used.add(index);return packets[index]}
  const jobs=await run({signal:AbortSignal.timeout(55000),now:()=>packets.find(p=>p.url.includes('/api/careerpagev2/filteredjobs'))?.completedAt,
   fetchPage:async(url,options)=>{const p=take(url,options);return{status:p.status,url:p.finalURL,html:p.body}},
   fetchJson:async(url,options)=>{const p=take(url,options);return url===NOAUTH_TOKEN_URL?{access_token:synthetic}:JSON.parse(p.body)}})
  proof(used.size===packets.length,'unused captured native response')
  const inventoryEvidence=readInventoryEvidence(jobs),provider=getScraperCatalog().find(p=>p.source==='navi')
  proof(provider?.bindingEvidence?.verified===true&&provider.companyDomain===contract.domain&&provider.companyCareerPage===contract.careers&&provider.turboHireOrgId===contract.orgId,'current exact catalog binding required')
  return{jobs:decorateJobsWithProviderMetadata(jobs,provider),inventoryEvidence,requestsUsed:used.size}
 }
 execute().then(result=>parentPort.postMessage({result}),error=>parentPort.postMessage({error:error.message}))
}

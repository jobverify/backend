import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { Worker,isMainThread,parentPort,workerData } from 'node:worker_threads'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'

// This exception accepts only these fresh independently reviewed native bytes.
// It never infers company coverage from the separate public jobs feed.
export const IVALUE_PARTIAL_CONTRACTS=Object.freeze({ivalue:Object.freeze({
 source:'ivalue',companyName:'iValue',domain:'ivaluegroup.com',careers:'https://ivaluegroup.com/en-in/careers/working-at-ivalue/',
 board:'https://ivgroup.greythr.com/hire/jobs/',nativeOrigin:'https://ivgroup.greythr.com',
 release:'0aa4dd0afeea7f5e7dd7d11017e8588f175b18c2a0de9e8e05e359354f315dc0',originalReplay:'cb335247f8b70c83bea273dd7edc057df9541ea0a1150eeb90faec2100e4ee0a',
 manifest:'61a87652afe938083f6857328726d82b592bad44559ee5c16e7e61e8e1eb2f9d',captureTrial:'69bf1d3d07df4865833b92d13179b24a5ea01f193b4027ab2c8effca1ac66aac',catalogTrial:'4d084f343cf76d982972a6fdcd3859a7d9ab494aba70c5e353314650896a5a2e',
 corporate:'7a0c4487c6b2c3859628c65234e00f8c3659630b6b862cc5a55753ea78201d0e',nativeClient:'0e286590b17d92dcb76cd96d1b565354b8be359f7f136c5d7d86faa471d81a7b',
 correctedReplay:'8665b71fa4e4776870decd7d93ef37be55c4995fc71e7ad09bdf5a1fd5118520',independentReview:'524846711ab983ce8a0f205f24967b3589f584f3f50447782e80703510912a20',independentReplay:'9250e8be840060fdddd2d1bb092b75aeb2022439e3216a2a99c1234a6e3fce3d',
})})
const c=IVALUE_PARTIAL_CONTRACTS.ivalue,backendRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),EVENTS=c.nativeOrigin+'/hire/api/career/get_hiring_events/'
const sha=b=>createHash('sha256').update(b).digest('hex'),proof=(ok,message)=>{if(!ok)throw Error('iValue partial proof: '+message)}
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)
const fresh=(s,now)=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&Date.parse(s)<=+now&&+now-Date.parse(s)<=48*3600000
const stableJobs=jobs=>jobs.map(({scrapedAt,...j})=>j),withoutCatalog=jobs=>jobs.map(({companyDomain,companyCareerPage,atsPlatform,...j})=>j),stableInventory=e=>Object.fromEntries(Object.entries(e).filter(([k])=>k!=='verifiedAt'))
const offlineReplay=packets=>new Promise((resolve,reject)=>{
 const worker=new Worker(new URL(import.meta.url),{workerData:{kind:'ivalue-reviewed-partial-offline-replay',packets},execArgv:[],stdout:true,stderr:true});worker.stdout.on('data',()=>{});worker.stderr.on('data',()=>{})
 let settled=false;const finish=(e,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();e?reject(e):resolve(result)},timer=setTimeout(()=>finish(Error('iValue proof replay deadline exceeded')),60000)
 worker.on('error',e=>finish(e));worker.on('exit',code=>{if(!settled)finish(Error('iValue replay exited without proof: '+code))});worker.on('message',m=>m.error?finish(Error(m.error)):finish(null,m.result))
})

export async function deriveIValuePartialEvidence({source,httpEvidence,readEvidence,now=new Date()}){
 proof(source==='ivalue','unsupported exact source')
 const receipts=httpEvidence?.receipts;proof(httpEvidence?.mode==='reviewed-ivalue-partial-exact-native-capture'&&Array.isArray(receipts)&&receipts.length>46&&receipts.length<100&&new Set(receipts.map(r=>r.file)).size===receipts.length,'unique exact reviewed receipts required')
 const groups=new Map()
 for(const r of receipts){
  proof(['original-release','original-replay','capture-manifest','capture-trial','catalog-trial','corporate-browser','native-client','independent-review','independent-replay','corrected-replay','native','current-code'].includes(r.kind),'unknown evidence kind')
  proof(typeof r.file==='string'&&/^evidence\/[a-z0-9._/-]+$/i.test(r.file)&&!r.file.split('/').includes('..'),'confined relative evidence required')
  const bytes=await readEvidence(r.file);proof(Buffer.isBuffer(bytes)&&bytes.length===r.bytes&&sha(bytes)===r.sha256,'evidence bytes/hash mismatch');if(!groups.has(r.kind))groups.set(r.kind,[]);groups.get(r.kind).push({r,bytes})
 }
 const single=(kind,hash)=>{const rows=groups.get(kind);proof(rows?.length===1&&rows[0].r.sha256===hash,'exact approved '+kind+' required');return JSON.parse(rows[0].bytes)}
 const release=single('original-release',c.release),oldReplay=single('original-replay',c.originalReplay),m=single('capture-manifest',c.manifest),captured=single('capture-trial',c.captureTrial),original=single('catalog-trial',c.catalogTrial),browserProof=single('corporate-browser',c.corporate),client=single('native-client',c.nativeClient),corrected=single('corrected-replay',c.correctedReplay),review=single('independent-review',c.independentReview),rootReplay=single('independent-replay',c.independentReplay)
 proof(release.source==='ivalue'&&release.productionWrites===false&&release.trials.length===1&&release.trials[0].sha256===c.catalogTrial&&release.rawCaptureManifest.sha256===c.manifest,'original release mismatch')
 proof(m.source==='ivalue'&&m.productionWrites===false&&m.trialSha256===c.captureTrial&&m.packets.length===46&&captured.source==='ivalue'&&captured.productionWrites===false&&captured.mode==='captured-live-public-http-extraction-no-database','exact original native capture required')
 proof(original.source==='ivalue'&&original.productionWrites===false&&original.mode==='isolated-direct-live-extraction-no-database'&&original.outcome==='positive-extraction-incomplete-evidence','original matching catalog trial required')
 proof(fresh(captured.startedAt,now)&&fresh(captured.completedAt,now)&&Date.parse(captured.completedAt)>=Date.parse(captured.startedAt)&&fresh(original.attemptedAt,now)&&fresh(original.completedAt,now)&&Date.parse(original.completedAt)>=Date.parse(original.attemptedAt),'fresh original native and catalog windows required')
 proof(review.source==='ivalue'&&review.reviewStatus==='clear-native-selected-37-with-scope-and-identity-gaps-retained'&&review.productionWrites===false&&review.databaseReadOrWrite===false&&fresh(review.reviewedAt,now)&&review.selectedEligibleIndiaJobs===37&&review.observedRawIDs===40&&review.observedIndiaIDs===38&&review.identityRejections===1&&review.missingDescriptions===0&&review.unknownHiringEventScope===true&&review.noCompanyZeroOrCompleteClaim===true&&review.nativeReplay.sha256===c.independentReplay,'current independent source review required')
 proof(rootReplay.productionWrites===false&&rootReplay.databaseReadOrWrite===false&&fresh(rootReplay.checkedAt,now)&&rootReplay.originalReleaseSha256===c.release&&rootReplay.originalCaptureManifestSha256===c.manifest&&rootReplay.originalCaptureTrialSha256===c.captureTrial&&rootReplay.originalFrozenTrialSha256===c.catalogTrial&&rootReplay.exactPacketFileAndBodyHashesVerified===46&&rootReplay.everyRequestURLMethodBodyUsedOnce===true&&rootReplay.everyNativeJobFieldUnchanged===true,'independent exact native replay linkage mismatch')
 proof(fresh(corrected.checkedAt,now)&&corrected.productionWrites===false&&corrected.originalCaptureManifestSha256===c.manifest&&corrected.originalFrozenTrialSha256===c.catalogTrial&&canonical(corrected.originalCaptureCodeHashes)===canonical(m.sourceHashes)&&canonical(oldReplay.rawCaptureCodeHashes)===canonical(m.sourceHashes)&&canonical(release.sourceHashes)===canonical(oldReplay.currentReplayAndCatalogCodeHashes),'historical capture/release provenance mismatch')
 const codes=groups.get('current-code')||[];proof(codes.length===review.sourceCode.length&&new Set(codes.map(r=>r.r.sourcePath)).size===codes.length,'all current independently reviewed source copies required')
 for(const p of codes){const expected=review.sourceCode.find(row=>row.file===p.r.sourcePath);proof(expected&&expected.sha256===p.r.sha256&&corrected.currentSourceHashes[expected.file]===expected.sha256&&rootReplay.currentSourceHashes[expected.file]===expected.sha256,'current corrected source attestation mismatch');const file=path.resolve(backendRoot,expected.file),rel=path.relative(backendRoot,file);proof(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel)&&sha(fs.readFileSync(file))===expected.sha256,'current source differs from independently reviewed corrected code')}
 proof(m.sourceHashes['scraper/ivalue/script.js']!==corrected.currentSourceHashes['scraper/ivalue/script.js']&&m.sourceHashes['scraper/ivalue/nativeContract.js']!==corrected.currentSourceHashes['scraper/ivalue/nativeContract.js'],'capture-time and corrected code must remain explicitly distinct')
 let browser;try{browser=JSON.parse(browserProof.result.content[0].text.match(/### Result\n([\s\S]*?)\n### Ran Playwright code/)[1])}catch{proof(false,'actual rendered corporate proof malformed')}
 proof(browserProof.productionWrites===false&&browserProof.mode==='current-rendered-public-official-corporate-navigation-no-forms'&&browser.url===c.careers&&fresh(browser.checkedAt,now)&&browser.links.some(l=>l.href===c.board&&l.visible===true)&&Date.parse(captured.startedAt)>=Date.parse(browser.checkedAt),'fresh exact visible corporate-to-native browser handoff required')
 proof(sha(fs.readFileSync(path.join(backendRoot,'scraper/ivalue/fixtures/official-browser-binding-20261020.json')))===c.corporate,'current approved browser binding fixture differs')
 proof(client.status===200&&client.url===client.finalURL&&fresh(client.completedAt,now)&&typeof client.body==='string'&&sha(client.body)===client.bodySha256&&client.bodySha256===oldReplay.clientEvidence.bodySha256&&client.body.includes('If.post("/api/career/published_jobs/",n)')&&client.body.includes('t.num_jobs=t.filtered_job_data.length')&&client.body.includes('/api/career/get_hiring_events/'),'actual full-feed and unverified additional-event client contract required')
 const native=groups.get('native')||[],packets=[];proof(native.length===46&&new Set(native.map(p=>p.r.originFile)).size===46,'every original46 runtime response required')
 for(const p of native){
  const expected=m.packets.find(row=>row.file===p.r.originFile),packet=JSON.parse(p.bytes)
  proof(expected&&expected.sha256===p.r.sha256&&packet.url===expected.url&&packet.method===expected.method&&packet.status===200&&expected.status===200&&packet.finalURL===packet.url&&typeof packet.body==='string'&&sha(packet.body)===packet.bodySha256&&packet.bodySha256===expected.bodySha256&&fresh(packet.startedAt,now)&&fresh(packet.completedAt,now)&&Date.parse(packet.startedAt)>=Date.parse(captured.startedAt)&&Date.parse(packet.completedAt)>=Date.parse(packet.startedAt)&&Date.parse(packet.completedAt)<=Date.parse(m.completedAt),'successful exact fresh native response required')
  const u=new URL(packet.url);proof(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&[new URL(c.careers).origin,c.nativeOrigin].includes(u.origin),'native/official origin mismatch');packets.push(packet)
 }
 const corporate=packets.filter(p=>p.url===c.careers);proof(corporate.length===1&&/Incapsula/.test(corporate[0].body)&&/_Incapsula_Resource/.test(corporate[0].body)&&!corporate[0].body.includes(c.board),'blocked corporate HTTP must stay distinct from rendered identity proof')
 proof(Array.isArray(original.jobs)&&original.jobs.length===37&&original.rawJobs===40&&original.indiaJobs===37&&original.eligibleJobs===37&&original.inventoryEvidence?.listingComplete===false&&original.inventoryEvidence.reportedTotal===40&&original.inventoryEvidence.indiaFacetCount===38&&original.detailHealth.complete===false&&original.detailHealth.missingDescriptions===0,'original selected37/native40-38 gap must remain truthful')
 const replayed=await offlineReplay(packets)
 proof(replayed.requestsUsed===46&&canonical(stableJobs(replayed.jobs))===canonical(stableJobs(original.jobs))&&canonical(stableJobs(captured.jobs))===canonical(stableJobs(withoutCatalog(original.jobs))),'every selected original native and catalog field must remain unchanged')
 proof(canonical(replayed.diagnostics)===canonical(captured.nativeIdentityEvidence)&&canonical(stableInventory(replayed.inventoryEvidence))===canonical(stableInventory(original.inventoryEvidence)),'native identity gap and partial inventory differ from original')
 const d=replayed.diagnostics
 proof(d.rawObservedRows===40&&d.rawObservedIndiaRows===38&&d.uniquePublicUrls===39&&d.rejectedNativeIdentities.length===1&&d.rejectedNativeIdentities[0].reason==='ambiguous-public-url-resolves-to-another-native-identity'&&d.companyHealthComplete===false&&canonical(d.rejectedNativeIdentities)===canonical(rootReplay.rejectedNativeIdentities),'exact rejected identity must not be omitted or relabeled missing content')
 proof(original.jobs.every(j=>j.source==='ivalue'&&j.company==='iValue'&&j.companyDomain===c.domain&&j.companyCareerPage===c.careers&&j.country==='India'&&j.sourceListingComplete===false&&j.sourceDetailComplete===true&&typeof j.jobDescription==='string'&&j.jobDescription&&j.sourceCorporateCheck==='blocked-interstitial-used-fresh-approved-binding'),'selected role identity/content/India and partial flags mismatch')
 proof(analyzePublishableJobs(original.jobs,{now}).eligibleJobs.length===37,'every selected role must remain eligible now')
 const nativeBoardEvidence={scope:'verified-native-public-jobs-feed-only',rawIds:40,uniquePublicURLs:39,observedIndiaIDs:38,selectedVerifiedIndiaJobs:37,knownForeignPublicDetails:2,identityRejections:1,missingDescriptions:0}
 const companyScope={complete:false,globalTotal:null,indiaTotal:null,unverifiedHiringEventURL:EVENTS,reason:'Separate advertised hiring-event inventory has not been reconciled; no whole-company count or zero is established.'}
 return{jobs:original.jobs,startedAt:original.attemptedAt,capturedAt:original.completedAt,rawTotal:40,publicTotal:39,indiaTotal:38,
  nativeBoardEvidence,nativeIdentityEvidence:captured.nativeIdentityEvidence,companyScope,inventoryEvidence:original.inventoryEvidence,detailHealth:original.detailHealth,
  selectedDetailHealth:{complete:true,inspectedJobs:37,incompleteJobs:0,missingDescriptions:0,failureKinds:{}},filterCounts:{nonIndia:null,old:null,closed:null,invalidUrl:null,nonJob:null,emptyDescription:null},
  bindingEvidence:{source:'ivalue',companyName:'iValue',companyDomain:c.domain,careersUrl:c.careers,boardUrl:c.board,verifiedAt:browser.checkedAt,expiresAfterHours:48,corporateBrowserProofSha256:c.corporate,directCorporateHTTP:'blocked-interstitial-not-identity-proof',independentSourceReviewSha256:c.independentReview,correctedReplaySha256:c.correctedReplay},
  originalCapture:{releaseSha256:c.release,manifestSha256:c.manifest,nativeTrialSha256:c.captureTrial,catalogTrialSha256:c.catalogTrial,nativeStartedAt:captured.startedAt,nativeCompletedAt:captured.completedAt,catalogAttemptedAt:original.attemptedAt,catalogCompletedAt:original.completedAt,
   originalRunnerCounts:{rawJobs:40,returnedIndiaJobs:37,eligibleJobs:37},captureTimeCodeHashes:m.sourceHashes,initialReleaseCodeHashes:release.sourceHashes,currentReviewedCode:review.sourceCode,originalJobFieldsAndTimestampsPreserved:true},
  replayEvidence:{responsesUsed:46,originalBodiesVerified:46,mode:'isolated-exact-native-response-replay-no-network-no-database',syntheticJobContent:false,everyNativeFieldEqual:true}}
}

export async function verifyIValuePartialPublishingTrial({trial,bytes,readEvidence,now=new Date()}){
 proof(Buffer.isBuffer(bytes)&&canonical(JSON.parse(bytes))===canonical(trial),'trial differs from exact file bytes')
 proof(trial?.source==='ivalue'&&trial.schemaVersion===1&&trial.mode==='native-http-partial-positive-trial'&&trial.outcome==='positive-extraction-incomplete-evidence'&&trial.productionWrites===false&&trial.maxJobs==null&&trial.truncated!==true&&trial.rawJobs===40&&trial.indiaJobs===38&&trial.globalTotal===null,'exact untruncated observed-board40/38 partial trial with unknown company total required')
 const derived=await deriveIValuePartialEvidence({source:trial.source,httpEvidence:trial.httpEvidence,readEvidence,now})
 proof(trial.attemptedAt===derived.startedAt&&trial.completedAt===derived.capturedAt,'original catalog attempt times must be preserved')
 for(const field of ['originalCapture','bindingEvidence','inventoryEvidence','nativeBoardEvidence','nativeIdentityEvidence','companyScope','detailHealth','selectedDetailHealth','filterCounts'])proof(canonical(trial[field])===canonical(derived[field]),field+' differs from exact native proof')
 proof(trial.observedSelectedIndia===37&&canonical(trial.jobs)===canonical(derived.jobs),'every and only original37 selected job field must remain unchanged')
 return{...derived,trial,trialByteHash:sha(bytes),eligibleJobs:37}
}

if(!isMainThread&&workerData?.kind==='ivalue-reviewed-partial-offline-replay'){
 const execute=async()=>{
  globalThis.fetch=async()=>{throw Error('iValue proof forbids uncaptured network requests')}
  const {run,readIValueSourceDiagnostics}=await import('../scraper/ivalue/script.js'),{getScraperCatalog,decorateJobsWithProviderMetadata}=await import('../scraper-support/providers/index.js'),{readInventoryEvidence}=await import('../scraper-support/utils/inventoryEvidence.js')
  const packets=workerData.packets,used=new Set(),take=(url,options={})=>{const method=options.method||'GET',body=method==='POST'?JSON.stringify(options.body??{}):null,index=packets.findIndex((p,i)=>!used.has(i)&&p.url===url&&p.method===method&&p.requestBody===body);proof(index>=0,'uncaptured or repeated request URL/method/body');used.add(index);return packets[index]}
  const jobs=await run({signal:AbortSignal.timeout(55000),now:()=>packets[0].startedAt,fetchText:async(u,o)=>take(u,o).body,fetchJson:async(u,o)=>JSON.parse(take(u,o).body)})
  proof(used.size===packets.length,'unused native response');const provider=getScraperCatalog().find(p=>p.source==='ivalue');proof(provider?.bindingEvidence?.verified===true&&provider.companyDomain===c.domain&&provider.companyCareerPage===c.careers,'current exact catalog binding required')
  return{jobs:decorateJobsWithProviderMetadata(jobs,provider),inventoryEvidence:readInventoryEvidence(jobs),diagnostics:readIValueSourceDiagnostics(jobs),requestsUsed:used.size}
 }
 execute().then(result=>parentPort.postMessage({result}),error=>parentPort.postMessage({error:error.message}))
}

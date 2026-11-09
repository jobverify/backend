import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads'
import {analyzePublishableJobs} from '../scraper-support/utils/publishableJobMetrics.js'
import {extractOfficialRecruitmentLinks} from './officialRecruitmentLinks.js'

// This exception accepts only the four roles in these reviewed public bytes.
// The observed500 search results never establish whole-company coverage.
export const BOSTON_SCIENTIFIC_PARTIAL_CONTRACTS=Object.freeze({bostonscientific:Object.freeze({
 source:'bostonscientific',companyName:'Boston Scientific',domain:'bostonscientific.com',careers:'https://www.bostonscientific.com/en-IN/careers.html',
 board:'https://bostonscientific.eightfold.ai/careers',nativeOrigin:'https://bostonscientific.eightfold.ai',
 release:'fa27e3f76acc539f9aedaeda642e34701ce3b39eaa0e221ea0276d51ed56a708',originalReplay:'4ea70f7e17f1b96e7d0d96a36ef0a5f3ae763da43f3e8aaafe463d042952f1aa',
 manifest:'78a70c732e319ed22faeb01e8f899970f988230e8d6948b07f90d0f792e2b1ca',captureTrial:'c79db0bd6e4665df7868d94ca8b05c593c8dbfeb2bafd54c4b9e2fc8f219548d',catalogTrial:'cebd7abe6ffb8b9056c9c4cba62b95c5693a34477647cfe50c229e2dbe54716f',
 correctedReplay:'14a7eed3a5c858984e034f4a5596d903a45f9a6fedd86d0b28be5bdb187ff6e9',independentReview:'2dd8f585e43b4e2db3fb6fb318d6228acf8fd04c42ef14285c0d4fa765f2f848',independentReplay:'b90d8eea720909dd38bba1f9c346fd431954675af65ac27f7a2a34a4591306e5',
})})
const c=BOSTON_SCIENTIFIC_PARTIAL_CONTRACTS.bostonscientific,backendRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const sha=b=>createHash('sha256').update(b).digest('hex'),proof=(ok,message)=>{if(!ok)throw Error('Boston Scientific partial proof: '+message)}
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)
const fresh=(s,now)=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&Date.parse(s)<=+now&&+now-Date.parse(s)<=48*3600000
const stableJobs=jobs=>jobs.map(({scrapedAt,...j})=>j),withoutCatalog=jobs=>jobs.map(({companyDomain,companyCareerPage,atsPlatform,...j})=>j),stableInventory=e=>Object.fromEntries(Object.entries(e).filter(([k])=>k!=='verifiedAt'))
const offlineReplay=packets=>new Promise((resolve,reject)=>{
 const worker=new Worker(new URL(import.meta.url),{workerData:{kind:'bostonscientific-reviewed-partial-offline-replay',packets},execArgv:[],stdout:true,stderr:true});worker.stdout.on('data',()=>{});worker.stderr.on('data',()=>{})
 let settled=false;const finish=(e,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();e?reject(e):resolve(result)},timer=setTimeout(()=>finish(Error('Boston Scientific proof replay deadline exceeded')),60000)
 worker.on('error',e=>finish(e));worker.on('exit',code=>{if(!settled)finish(Error('Boston Scientific replay exited without proof: '+code))});worker.on('message',m=>m.error?finish(Error(m.error)):finish(null,m.result))
})

export async function deriveBostonScientificPartialEvidence({source,httpEvidence,readEvidence,now=new Date()}){
 proof(source==='bostonscientific','unsupported exact source')
 const receipts=httpEvidence?.receipts;proof(httpEvidence?.mode==='reviewed-bostonscientific-partial-exact-native-capture-v2'&&httpEvidence.reviewVersion===2&&Array.isArray(receipts)&&receipts.length===78&&new Set(receipts.map(r=>r.file)).size===receipts.length,'unique exact reviewed version2 receipts required')
 const groups=new Map()
 for(const r of receipts){
  proof(['original-release','original-replay','capture-manifest','capture-trial','catalog-trial','independent-review','independent-replay','corrected-replay','official-proof','native','current-code','provider-extension'].includes(r.kind),'unknown evidence kind')
  proof(typeof r.file==='string'&&/^evidence\/[a-z0-9._/-]+$/i.test(r.file)&&!r.file.split('/').includes('..'),'confined relative evidence required')
  const bytes=await readEvidence(r.file);proof(Buffer.isBuffer(bytes)&&bytes.length===r.bytes&&sha(bytes)===r.sha256,'evidence bytes/hash mismatch');if(!groups.has(r.kind))groups.set(r.kind,[]);groups.get(r.kind).push({r,bytes})
 }
 const single=(kind,hash)=>{const rows=groups.get(kind);proof(rows?.length===1&&rows[0].r.sha256===hash,'exact approved '+kind+' required');return JSON.parse(rows[0].bytes)}
 const release=single('original-release',c.release),oldReplay=single('original-replay',c.originalReplay),m=single('capture-manifest',c.manifest),captured=single('capture-trial',c.captureTrial),original=single('catalog-trial',c.catalogTrial),corrected=single('corrected-replay',c.correctedReplay),review=single('independent-review',c.independentReview),rootReplay=single('independent-replay',c.independentReplay)
 proof(release.source===source&&release.productionWrites===false&&release.trials.length===1&&release.trials[0].sha256===c.catalogTrial&&release.rawCaptureManifest.sha256===c.manifest&&release.replayProof.sha256===c.originalReplay,'original release mismatch')
 proof(m.source===source&&m.productionWrites===false&&m.trialSha256===c.captureTrial&&m.packets.length===60&&captured.source===source&&captured.productionWrites===false&&captured.mode==='captured-live-public-http-extraction-no-database','exact original native capture required')
 proof(original.source===source&&original.productionWrites===false&&original.mode==='isolated-direct-live-extraction-no-database'&&original.outcome==='positive-extraction-incomplete-evidence','original matching catalog trial required')
 proof(fresh(captured.startedAt,now)&&fresh(captured.completedAt,now)&&Date.parse(captured.completedAt)>=Date.parse(captured.startedAt)&&fresh(original.attemptedAt,now)&&fresh(original.completedAt,now)&&Date.parse(original.completedAt)>=Date.parse(original.attemptedAt),'fresh original native and catalog windows required')
 proof(review.source===source&&review.reviewStatus==='clear-four-native-India-roles-with-observed-search-ceiling-and-geography-gaps'&&review.productionWrites===false&&review.databaseReadOrWrite===false&&fresh(review.reviewedAt,now)&&review.selectedEligibleIndiaJobs===4&&review.observedSearchRows===500&&review.observedUniqueIDs===500&&review.unresolvedGeographyRows===7&&review.wholeCompanyGlobalTotal===null&&review.wholeCompanyIndiaTotal===null&&review.possibleNativeSearchCeilingRetained===true&&review.sourceListingComplete===false&&review.nativeReplay.sha256===c.independentReplay,'current independent source review required')
 for(const p of [corrected,rootReplay])proof(p.productionWrites===false&&p.databaseReadOrWrite===false&&fresh(p.checkedAt,now)&&p.originalReleaseSha256===c.release&&p.originalCaptureManifestSha256===c.manifest&&p.originalCaptureTrialSha256===c.captureTrial&&p.originalFrozenTrialSha256===c.catalogTrial&&p.exactResponseFileAndBodyHashesVerified===60&&p.everyRequestURLMethodBodyUsedOnce===true&&p.everyOriginalNativeJobFieldUnchanged===true&&p.sourceListingComplete===false&&p.observedNativeScope.wholeCompanyTotal===null&&p.observedNativeScope.wholeCompanyIndiaTotal===null,'exact reviewed native replay linkage mismatch')
 proof(canonical(corrected.captureTimeSourceHashes)===canonical(m.sourceHashes)&&canonical(oldReplay.captureTimeSourceHashes)===canonical(m.sourceHashes)&&canonical(release.captureTimeSourceHashes)===canonical(m.sourceHashes)&&canonical(release.currentReplaySourceHashes)===canonical(oldReplay.currentReplaySourceHashes),'historical capture/release provenance mismatch')
 const codes=groups.get('current-code')||[];proof(codes.length===3&&codes.length===review.sourceCode.length&&new Set(codes.map(p=>p.r.sourcePath)).size===3,'all current independently reviewed source copies required')
 const currentFile=(file,hash)=>{const absolute=path.resolve(backendRoot,file),rel=path.relative(backendRoot,absolute);proof(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel)&&sha(fs.readFileSync(absolute))===hash,'current source differs from independently reviewed code')}
 for(const p of codes){const expected=review.sourceCode.find(row=>row.file===p.r.sourcePath);proof(expected&&expected.sha256===p.r.sha256&&corrected.currentSourceHashes[expected.file]===expected.sha256&&rootReplay.currentSourceHashes[expected.file]===expected.sha256,'current corrected source attestation mismatch');currentFile(expected.file,expected.sha256)}
 proof(['script.js','nativeContract.js','nativeContent.js'].every(file=>m.sourceHashes['scraper/bostonscientific/'+file]!==corrected.currentSourceHashes['scraper/bostonscientific/'+file]),'capture-time and corrected code must remain explicitly distinct')
 single('provider-extension',release.extension.sha256);proof(groups.get('provider-extension')[0].r.sourcePath===release.extension.file,'exact catalog extension required');currentFile(release.extension.file,release.extension.sha256)
 const official=groups.get('official-proof')||[];proof(official.length===6&&new Set(official.map(p=>p.r.originFile)).size===6,'every original official proof required')
 const officialPages=new Map()
 for(const p of official){const expected=release.proofs.find(row=>row.file===p.r.originFile);proof(expected&&p.r.sha256===expected.sha256,'original official proof linkage mismatch');const packet=JSON.parse(p.bytes);if(typeof packet.body==='string'){proof(packet.status===200&&packet.url===packet.finalURL&&sha(packet.body)===packet.bodySha256&&fresh(packet.startedAt,now)&&fresh(packet.checkedAt,now),'successful fresh official public proof required');officialPages.set(p.r.originFile,packet)}}
 const corporate=officialPages.get('corporate-001.json'),board=officialPages.get('board-001.json'),client=officialPages.get('client-001.json')
 proof(corporate?.url===c.careers&&extractOfficialRecruitmentLinks(corporate.body,c.careers).some(l=>l.href===c.board)&&board?.url===c.board&&client?.url.startsWith(c.nativeOrigin+'/gen/js/')&&board.body.includes('<script defer src="'+new URL(client.url).pathname+'"></script>')&&client.body.includes('/api/pcsx/search')&&client.body.includes('/api/pcsx/position_details'),'current exact official corporate/native/client handoff required')
 const native=groups.get('native')||[],packets=[];proof(native.length===60&&new Set(native.map(p=>p.r.originFile)).size===60,'every original60 runtime response required')
 for(const p of native){
  const expected=m.packets.find(row=>row.file===p.r.originFile),packet=JSON.parse(p.bytes)
  proof(expected&&expected.sha256===p.r.sha256&&packet.url===expected.url&&packet.method===expected.method&&packet.method==='GET'&&packet.requestBody===null&&packet.status===200&&expected.status===200&&packet.finalURL===packet.url&&typeof packet.body==='string'&&sha(packet.body)===packet.bodySha256&&packet.bodySha256===expected.bodySha256&&fresh(packet.startedAt,now)&&fresh(packet.completedAt,now)&&Date.parse(packet.startedAt)>=Date.parse(captured.startedAt)&&Date.parse(packet.completedAt)>=Date.parse(packet.startedAt)&&Date.parse(packet.completedAt)<=Date.parse(m.completedAt),'successful exact fresh native response required')
  const u=new URL(packet.url);proof(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&[new URL(c.careers).origin,c.nativeOrigin].includes(u.origin),'native/official origin mismatch');packets.push(packet)
 }
 const globals=packets.filter(p=>new URL(p.url).pathname==='/api/pcsx/search'&&!new URL(p.url).searchParams.has('filter_country')),rows=[]
 proof(globals.length===52&&globals[0].bodySha256===globals.at(-1).bodySha256,'observed native first/final page mismatch')
 for(let i=0;i<51;i++){const p=globals[i],u=new URL(p.url),d=JSON.parse(p.body).data;proof(+u.searchParams.get('start')===i*10&&u.searchParams.get('limit')==='10'&&d.count===500&&canonical(d.appliedFilters)==='{}'&&d.positions.length===(i===50?0:10),'observed10-row native pages/terminal do not reconcile');rows.push(...d.positions)}
 proof(rows.length===500&&new Set(rows.map(r=>r.id)).size===500&&new Set(rows.map(r=>r.positionUrl)).size===500,'observed500 native identities do not reconcile')
 proof(Array.isArray(original.jobs)&&original.jobs.length===4&&original.rawJobs===500&&original.indiaJobs===4&&original.eligibleJobs===4&&original.inventoryEvidence?.listingComplete===false&&original.inventoryEvidence.reportedTotal===500&&original.inventoryEvidence.indiaFacetCount===4&&original.detailHealth.complete===false&&original.detailHealth.missingDescriptions===0,'original four selected jobs and partial source health required')
 const replayed=await offlineReplay(packets)
 proof(replayed.requestsUsed===60&&canonical(stableJobs(replayed.jobs))===canonical(stableJobs(original.jobs))&&canonical(stableJobs(captured.jobs))===canonical(stableJobs(withoutCatalog(original.jobs))),'every selected original native and catalog field must remain unchanged')
 proof(canonical(replayed.diagnostics)===canonical(captured.nativeIdentityEvidence)&&canonical(stableInventory(replayed.inventoryEvidence))===canonical(stableInventory(original.inventoryEvidence)),'native unknown geographies and partial inventory differ from original')
 const d=replayed.diagnostics
 proof(d.reportedGlobalTotal===500&&d.uniqueGlobalIdentities===500&&d.knownIndiaRows===4&&d.unresolvedScopes.length===7&&d.companyHealthComplete===false&&canonical(d.unresolvedScopes)===canonical(rootReplay.unresolvedScopes)&&d.unresolvedScopes.every(r=>rows.some(p=>p.id===r.id)&&!original.jobs.some(j=>j.jobId===r.id)),'all actual unresolved geography records must remain unknown and excluded')
 proof(original.jobs.every(j=>j.source===source&&j.company===c.companyName&&j.companyDomain===c.domain&&j.companyCareerPage===c.careers&&j.country==='India'&&j.sourceListingComplete===false&&j.sourceDetailComplete===true&&typeof j.jobDescription==='string'&&j.jobDescription.length>1000),'selected role identity/content/India and partial flags mismatch')
 proof(analyzePublishableJobs(original.jobs,{now}).eligibleJobs.length===4,'every selected role must remain eligible now')
 const nativeBoardEvidence={scope:'observed-public-native-search-only',reportedSearchCount:500,uniqueObservedIDs:500,pageSize:10,nonemptyGlobalPages:50,emptyTerminalStart:500,finalFirstPageStable:true,knownIndiaCountryFacet:4,selectedVerifiedIndiaJobs:4,unresolvedGeographyRows:7,searchCeilingUnresolved:true,uncappedSearchContractEstablished:false,missingDescriptions:0}
 const companyScope={complete:false,globalTotal:null,indiaTotal:null,reason:'Observed500 public-search records may reach a search ceiling; seven native geography scopes remain unresolved. No uncapped whole-company or India total is established.'}
 return{jobs:original.jobs,startedAt:original.attemptedAt,capturedAt:original.completedAt,rawTotal:500,publicTotal:null,indiaTotal:null,
  nativeBoardEvidence,nativeIdentityEvidence:captured.nativeIdentityEvidence,companyScope,inventoryEvidence:original.inventoryEvidence,detailHealth:original.detailHealth,
  selectedDetailHealth:{complete:true,inspectedJobs:4,incompleteJobs:0,missingDescriptions:0,failureKinds:{}},filterCounts:{nonIndia:null,old:null,closed:null,invalidUrl:null,nonJob:null,emptyDescription:null},
  bindingEvidence:{source,companyName:c.companyName,companyDomain:c.domain,careersUrl:c.careers,boardUrl:c.board,verifiedAt:corporate.checkedAt,expiresAfterHours:48,officialCorporateProofSha256:release.proofs.find(r=>r.file==='corporate-001.json').sha256,independentSourceReviewSha256:c.independentReview,correctedReplaySha256:c.correctedReplay},
  originalCapture:{releaseSha256:c.release,manifestSha256:c.manifest,nativeTrialSha256:c.captureTrial,catalogTrialSha256:c.catalogTrial,nativeStartedAt:captured.startedAt,nativeCompletedAt:captured.completedAt,catalogAttemptedAt:original.attemptedAt,catalogCompletedAt:original.completedAt,
   originalRunnerCounts:{observedNativeSearchRows:500,returnedIndiaJobs:4,eligibleJobs:4},captureTimeCodeHashes:m.sourceHashes,initialReleaseCodeHashes:release.currentReplaySourceHashes,currentReviewedCode:review.sourceCode,originalJobFieldsAndTimestampsPreserved:true},
  replayEvidence:{responsesUsed:60,originalBodiesVerified:60,mode:'isolated-exact-native-response-replay-no-network-no-database',syntheticJobContent:false,everyNativeFieldEqual:true}}
}

export async function verifyBostonScientificPartialPublishingTrial({trial,bytes,readEvidence,now=new Date()}){
 proof(Buffer.isBuffer(bytes)&&canonical(JSON.parse(bytes))===canonical(trial),'trial differs from exact file bytes')
 proof(trial?.source==='bostonscientific'&&trial.schemaVersion===1&&trial.mode==='native-http-partial-positive-trial'&&trial.outcome==='positive-extraction-incomplete-evidence'&&trial.productionWrites===false&&trial.maxJobs==null&&trial.truncated!==true&&trial.rawJobs===500&&trial.indiaJobs===null&&trial.globalTotal===null,'exact observed-surface500 partial trial with unknown company India/global totals required')
 const derived=await deriveBostonScientificPartialEvidence({source:trial.source,httpEvidence:trial.httpEvidence,readEvidence,now})
 proof(trial.attemptedAt===derived.startedAt&&trial.completedAt===derived.capturedAt,'original catalog attempt times must be preserved')
 for(const field of ['originalCapture','bindingEvidence','inventoryEvidence','nativeBoardEvidence','nativeIdentityEvidence','companyScope','detailHealth','selectedDetailHealth','filterCounts'])proof(canonical(trial[field])===canonical(derived[field]),field+' differs from exact native proof')
 proof(trial.observedSelectedIndia===4&&canonical(trial.jobs)===canonical(derived.jobs),'every and only original four selected job fields must remain unchanged')
 return{...derived,trial,trialByteHash:sha(bytes),eligibleJobs:4}
}

if(!isMainThread&&workerData?.kind==='bostonscientific-reviewed-partial-offline-replay'){
 const execute=async()=>{
  globalThis.fetch=async()=>{throw Error('Boston Scientific proof forbids uncaptured network requests')}
  const{run,readBostonScientificDiagnostics}=await import('../scraper/bostonscientific/script.js'),{getScraperCatalog,decorateJobsWithProviderMetadata}=await import('../scraper-support/providers/index.js'),{readInventoryEvidence}=await import('../scraper-support/utils/inventoryEvidence.js')
  const packets=workerData.packets,used=new Set(),take=(url,options={})=>{const index=packets.findIndex((p,i)=>!used.has(i)&&p.url===url&&p.method===(options.method||'GET')&&(p.requestBody||null)===(options.body||null));proof(index>=0,'uncaptured or repeated request URL/method/body');used.add(index);return packets[index]}
  const jobs=await run({signal:AbortSignal.timeout(55000),now:()=>packets[0].startedAt,fetchText:async(u,o)=>take(u,o).body,fetchJson:async(u,o)=>JSON.parse(take(u,o).body)})
  proof(used.size===packets.length,'unused native response');const provider=getScraperCatalog().find(p=>p.source==='bostonscientific');proof(provider?.bindingEvidence?.verified===true&&provider.companyName===c.companyName&&provider.companyDomain===c.domain&&provider.companyCareerPage===c.careers,'current exact catalog binding required')
  return{jobs:decorateJobsWithProviderMetadata(jobs,provider),inventoryEvidence:readInventoryEvidence(jobs),diagnostics:readBostonScientificDiagnostics(jobs),requestsUsed:used.size}
 }
 execute().then(result=>parentPort.postMessage({result}),error=>parentPort.postMessage({error:error.message}))
}

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createLennoxTransport} from './transport20261111.js'
import {profile,need,readCorporate,readShell,readListing,readRole} from './nativeContract20261111.js'

export const SOURCE = "lennoxinternational"
export const COMPANY = "Lennox International"
export const CAREERS_URL = 'https://www.lennox.com/in'
export const DISPOSITION = 'current-source-local-icims-own-role-contract'
export const VERIFIED_ON = '2026-11-11'
export const VERIFIED_SURFACE_SUMMARY = 'Corporate India pages actively delegate to the global iCIMS shell; its reviewed active iframe program declares a native listing. Own role schema, native header and full criteria are reconciled with separate closing reads. Company and India totals and cleanup remain unverified.'
export async function run(options={}){
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage&&options.maxJobs==null&&options.maxPages==null,'full native HTTP response contract required; partial caller caps unsupported')
 const receipts=[],session=createLennoxTransport(options,receipts)
 const read=async(url,parser,kind='html')=>{const response=await session.read(url,kind);const model=parser(response.text,response.receipt);session.check();return model}
 const verifyAssets=async shell=>{
  for(const asset of shell.reviewedShellAssets)await read(asset.url,(_body,receipt)=>need(receipt.sha256===asset.sha256,'reviewed current shell asset bytes changed'),'javascript')
 }
 const readPages=async shell=>{
  const pages=[],seen=new Set(),ids=new Set();let url=shell.declaredFrameURL
  while(url){
   need(!seen.has(url)&&pages.length<shell.listingPageLimit,'native pagination cycle or page budget exceeded');seen.add(url)
   const page=await read(url,html=>readListing(html,{requestedURL:url,pageNumber:pages.length+1,maxPages:shell.listingPageLimit}));pages.push(page)
   for(const row of page.rows){need(!ids.has(row.nativeJobId),'duplicate native listing identities across pages');ids.add(row.nativeJobId)}
   url=page.nextURL
  }
  const rows=pages.flatMap(page=>page.rows)
  need(pages.every(page=>page.declaredPageCount===pages.length)&&rows.length<=30,'complete bounded native page count changed')
  return{...pages[0],rows,observedNativeCount:rows.length,listingPageCount:pages.length,pages}
 }
 try{
  const corporate=[]
  for(const url of profile.corporateURLs)corporate.push(await read(url,html=>readCorporate(html,url)))
  const shell=await read(profile.shellURL,readShell);await verifyAssets(shell)
  const listing=await readPages(shell),models=[]
  need(receipts.length+2*listing.rows.length+listing.listingPageCount+1+shell.reviewedShellAssets.length+profile.corporateURLs.length<=64,'native read budget cannot cover complete observed full-detail and pagination closing')
  for(const row of listing.rows)models.push(await read(row.requestedURL,html=>readRole(html,row)))
  for(let i=0;i<listing.rows.length;i++){
   const row=listing.rows[i],closing=await read(row.requestedURL,html=>readRole(html,row))
   need(isDeepStrictEqual(models[i],closing),'closing own role identity/country/employer/full criteria changed')
  }
  need(isDeepStrictEqual(listing,await readPages(shell)),'closing native listing membership/metadata changed')
  const closingShell=await read(profile.shellURL,readShell)
  need(isDeepStrictEqual(shell,closingShell),'closing native shell delegation changed');await verifyAssets(closingShell)
  for(let i=0;i<profile.corporateURLs.length;i++){
   const url=profile.corporateURLs[i];need(isDeepStrictEqual(corporate[i],await read(url,html=>readCorporate(html,url))),'closing corporate declaration changed')
  }
  const jobs=models.filter(model=>model.country==='India'),nonIndia=models.filter(model=>model.country!=='India')
  const audit={source:SOURCE,productionWrites:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,
   observedNativeCount:listing.rows.length,observedIndiaCount:jobs.length,observedNonIndiaCount:nonIndia.length,unknownCountryCount:0,corporateDeclarations:corporate,shellDeclaration:shell,
   listing,originalPages:receipts,nativeRecords:structuredClone(models),closingInventoryMatches:true,closingOwnModelsMatch:true,closingCorporateMatches:true,
   remainingProofs:['company global hiring channels and complete India scope','legal employer identity'],legalEmployerVerified:false}
  Object.defineProperty(jobs,'sourceAudit',{value:audit})
  const fullEvidence={source:SOURCE,observedListingCount:models.length,observedIndiaListingCount:jobs.length,nonIndiaListingCount:nonIndia.length,candidateDetails:models.length,failures:[],jobs:structuredClone(jobs),exclusions:structuredClone(nonIndia),extractedDetailJobs:jobs.length,excludedDetailJobs:nonIndia.length,listingPaginationComplete:true,closingInventoryMatches:true,sourceScopeComplete:false,firstExtractedJobID:jobs[0]?.jobId??null,retainedResponses:receipts.map(p=>({url:p.url,bodySHA256:p.sha256,requestedAt:p.requestedAt,completedAt:p.observedAt})),originalPages:receipts,corporateDeclarations:corporate,shellDeclaration:shell}
  for(let i=0;i<jobs.length;i++)jobs[i].nativeCollectionEvidence=i===0?fullEvidence:{source:SOURCE,observedListingCount:models.length,observedIndiaListingCount:jobs.length,nonIndiaListingCount:nonIndia.length,candidateDetails:models.length,failures:[],extractedDetailJobs:jobs.length,excludedDetailJobs:nonIndia.length,listingPaginationComplete:true,closingInventoryMatches:true,sourceScopeComplete:false,retainedResponsesOnFirstExtractedJob:true,fullBatchEvidenceOnFirstExtractedJob:true,firstExtractedJobID:jobs[0].jobId,retainedResponseCount:receipts.length}
  await session.race(()=>options.onAudit?.(structuredClone(audit)));session.check()
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:models.length,observedVacancyCount:models.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:listing.listingPageCount,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-lennox-india-selected-native-listing-and-own-criteria-observed-company-scope-unverified'})
 }catch(error){
  if(error instanceof Error&&!options.signal?.aborted&&Object.isExtensible(error)){
   const retry=Object.getOwnPropertyDescriptor(error,'abortRetries')
   if(!retry||retry.configurable)Object.defineProperty(error,'abortRetries',{value:true,writable:true,configurable:true,enumerable:true})
   else if(retry.writable)error.abortRetries=true
   const packets=receipts.map(p=>({url:p.url,status:p.status,finalURL:p.finalUrl,headers:p.headers,rawBodyBase64:p.rawBodyBase64,bodyBytes:p.bytes,bodySHA256:p.sha256,requestedAt:p.requestedAt,completedAt:p.observedAt,...(p.error?{failure:{message:p.error}}:{})}))
   Object.defineProperty(error,'nativeReadEvidence',{value:{source:SOURCE,productionWrites:false,originalPages:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
   Object.defineProperty(error,'nativeEvidence',{value:{source:SOURCE,observedListingCount:null,jobs:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,inventoryComplete:false,transportPackets:packets,retainedResponses:packets,failures:[{stage:'native-read-or-contract',message:error.message,name:error.name}]}})
  }
  throw error
 }finally{session.close()}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}

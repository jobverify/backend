import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createFirstPartyHTMLScraper,createHTMLTransport} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {nativePostingJobs} from '../../scraper-support/shared/nativeJobPosting.js'
import {createSourceConfig,HOME,BOARD,SOURCE,COMPANY} from './parser.js'
import {OKTA_CATALOG} from './catalog.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export {SOURCE,COMPANY}
export const PROVIDER_METADATA=OKTA_CATALOG
export const OFFICIAL_BRAND_NAME=COMPANY,HOMEPAGE_URL='https://www.okta.com/',CAREERS_URL=HOME,PUBLIC_BOARD_URL=BOARD
export const VERIFIED_ON='2026-10-23'
export const DISPOSITION='official-Drupal-native-role-details'
export const VERIFIED_SURFACE_SUMMARY='Official Okta native India listing and full role article;original JobPosting dates/native IDs/location strings retained. Schema teaser and application form remain separate. Whole-employer/legal scope and production unknown;cleanup forbidden.'
export const run=(options={})=>{
 const config=createSourceConfig(options),stop=new AbortController()
 const signal=options.signal?AbortSignal.any([options.signal,stop.signal]):stop.signal
 const raw=options.transport||createHTMLTransport(config,{...options,signal})
 const transport=async(url,request)=>{
  const packet=await raw(url,request)
  if([401,403,429].includes(packet?.status))stop.abort(Object.assign(Error('Okta public access/rate limit;no further requests'),{code:'NATIVE_PUBLIC_READ_STOPPED'}))
  return packet
 }
 config.projectJobs=result=>{
  result.nonIndiaListingCount=result.listingRecords.filter(r=>!config.candidateForIndia(r)).length
  result.observedIndiaListingCount=result.listingRecords.length-result.nonIndiaListingCount
  return nativePostingJobs(result,config).map(job=>{
   const labels=job.nativeFacts.nativeIndiaLocationLabels
   const cities=[...new Set(labels.map(label=>label==='India'?null:label.split(',')[0]).filter(Boolean))]
   return{...job,requisitionId:null,postingDate:job.nativeFacts.nativePostedDate.iso,postedAt:job.nativeFacts.nativePostedDate.iso,
    nativeExternalJobID:job.nativeFacts.nativeExternalJobID,nativeInternalJobID:job.nativeFacts.nativeInternalJobID,
    nativeDescriptionOrigin:job.nativeFacts.nativeDescriptionOrigin,city:cities.length===1?cities[0]:null,state:null,location:labels.join(' / '),
    employmentType:Array.isArray(job.nativeFacts.nativeJobPosting.employmentType)?job.nativeFacts.nativeJobPosting.employmentType.join(', '):null,
    nativeApplicationFormAttributesReadOnly:true}
  })
 }
 return createFirstPartyHTMLScraper(config).run({...options,signal,transport})
}
export const createOktaScraper=(defaults={})=>({run:options=>run({...defaults,...options})})
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}

import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadConfig} from '../../scraper-support/utils/loadConfig.js'
import {collectFirstPartyNativeRoles} from '../../scraper-support/native-sources/collectFirstPartyNativeRoles.js'
import {CONFIGURED_URL,CURRENT_URL,extractCurrentListings,extractCurrentDetail,isCurrentRoleURL} from './currentNative.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url)),config=loadConfig(currentDir)
export const SOURCE='detecttechnologies',COMPANY='Detect Technologies',CAREER_PAGE_URL=CONFIGURED_URL
export {CURRENT_URL}
export const buildSearchUrl=()=>CAREER_PAGE_URL
export const pageIndicatesJobCards=html=>{try{return extractCurrentListings(html).length>0}catch{return false}}
export const extractSearchResults=extractCurrentListings,extractJobDetail=extractCurrentDetail
export const createDetectTechnologiesScraper=(defaults={})=>({
 run(options={}){
  const settings={...defaults,...options}
  if(settings.maxJobs==null&&Number.isSafeInteger(config.maxJobs)&&config.maxJobs>0)settings.maxJobs=config.maxJobs
  return collectFirstPartyNativeRoles(settings,{source:SOURCE,company:COMPANY,companyDomain:'detecttechnologies.com',atsPlatform:'official-company-careers',
   configuredURL:CAREER_PAGE_URL,currentURL:CURRENT_URL,redirectTarget:CURRENT_URL,parseIndex:extractCurrentListings,parseDetail:extractCurrentDetail,isRoleURL:isCurrentRoleURL})
 }
})
export const run=options=>createDetectTechnologiesScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}

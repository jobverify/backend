import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {collectFirstPartyNativeRoles} from '../../scraper-support/native-sources/collectFirstPartyNativeRoles.js'
import {E2LOGY_SOFTWARE_SOLUTIONS_CATALOG as CATALOG} from './catalog.js'
import {CAREERS_URL,extractCurrentListings,extractCurrentDetail,isCurrentRoleURL} from './currentNative.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE=CATALOG.source,COMPANY=CATALOG.companyName,COMPANY_DOMAIN=CATALOG.companyDomain,ZOHO_SITE='https://e2logy.zohorecruit.com'
export {CAREERS_URL}
export const buildZohoJobsApiUrl=()=>ZOHO_SITE+'/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'
export const hasOfficialCareersSignal=html=>{try{return extractCurrentListings(html).length>0}catch{return false}}
// The former empty template and detached API do not establish current scope.
export const hasVerifiedEmptyCareersSurface=()=>false
export const extractListings=extractCurrentListings,extractJobDetail=extractCurrentDetail
export const createE2logySoftwareSolutionsScraper=(defaults={})=>({
 run(options={}){
  return collectFirstPartyNativeRoles({requestTimeoutMs:30000,sourceTimeoutMs:180000,...defaults,...options},{source:SOURCE,company:COMPANY,companyDomain:COMPANY_DOMAIN,atsPlatform:CATALOG.atsPlatform,requestTimeoutCeilingMs:30000,
   configuredURL:CAREERS_URL,parseIndex:extractCurrentListings,parseDetail:extractCurrentDetail,isRoleURL:isCurrentRoleURL})
 }
})
export const run=options=>createE2logySoftwareSolutionsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}

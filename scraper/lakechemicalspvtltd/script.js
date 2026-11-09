import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runLakeCurrentInventory} from './nativeCareers.js'
import {readLakeNativeHome,readLakeNativeBoard,makeLakeObservation} from './nativeModels.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='lakechemicalspvtltd',COMPANY='Lake Chemicals Pvt. Ltd'
export const HOMEPAGE_URL='https://lakechemicals.com/',JOB_SEARCH_URL='https://lakechemicals.com/job-search'
export const VERIFIED_ON='2026-11-05'
export const VERIFIED_SURFACE_SUMMARY='Current native roles retain whole published criteria and exact role-assigned named worksite addresses with explicit India country, reconciled at closing. Shared application links preserve distinct native role identities. Undisclosed requisitions, dates and legal employer remain unknown. Company completeness and cleanup remain unqualified.'
const unavailable=/fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to|getaddrinfo|enotfound/i
export const isVerifiedLakeChemicalsUnavailableError=error=>[error?.message,error?.cause?.code,error?.cause?.message,String(error??'')].some(v=>unavailable.test(String(v??'')))
export const normalizeLocationData=value=>{
 const location=String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()||null
 return {location,city:null,country:location&&/(?:^|,\s*)India$/i.test(location)?'India':null}
}
export const hasOfficialHomepageSignal=html=>{try{readLakeNativeHome(html);return true}catch{return false}}
export const hasOfficialJobSearchSignal=html=>{try{readLakeNativeBoard(html);return true}catch{return false}}
export const extractPublicJobs=html=>{
 const page=readLakeNativeBoard(html)
 return page.rows.map(row=>makeLakeObservation(row,null,page,html,null,null))
}
export const createLakeChemicalsPvtLtdScraper=(defaults={})=>({run:(options={})=>runLakeCurrentInventory({...defaults,...options})})
export const run=async(options={})=>createLakeChemicalsPvtLtdScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}

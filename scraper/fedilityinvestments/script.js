import path from 'node:path'
import {fileURLToPath} from 'node:url'
import FEDILITY_INVESTMENTS_CATALOG from './catalog.js'
import {createFidelityScraper,extractJobsFromFeed as legacyFeedRows,normalizeEmploymentType,createDefaultFetchText} from '../fidelity/script.js'
import {parseFidelityBoard,parseFidelityFeed} from '../fidelity/nativeContract.js'
import {runWithFidelityDelegation} from './nativeDelegation.js'

export const PROVIDER_METADATA=FEDILITY_INVESTMENTS_CATALOG
export const SOURCE='fedilityinvestments'
export const CANONICAL_SOURCE='fidelity'
export const COMPANY='Fidelity Investments'
export const OFFICIAL_BRAND_NAME=COMPANY
export const JOBS_PAGE_URL=FEDILITY_INVESTMENTS_CATALOG.companyCareerPage
export const JOBS_XML_URL=FEDILITY_INVESTMENTS_CATALOG.jobsFeedUrl
export const OFFICIAL_JOB_DETAIL_EXAMPLE_URL=FEDILITY_INVESTMENTS_CATALOG.officialJobDetailExampleUrl
export const VERIFIED_ON=null
export const VERIFIED_SURFACE_SUMMARY=FEDILITY_INVESTMENTS_CATALOG.verifiedSurfaceSummary
export {normalizeEmploymentType,createDefaultFetchText}
// Preserve the historical pure-parser contract; guarded runtime never uses it.
export const extractJobsFromFeed=xml=>legacyFeedRows(xml).map(j=>({...j,jobDescription:j.jobDescription?.replace(/\]\]>/g,'').replace(/[\u2013\u2014]/g,'-').replace(/\s+:/g,':').trim()||null}))
export const hasCloudflareChallengePageSignal=(html='')=>/<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)&&/enable javascript and cookies to continue/i.test(html)
export const hasOfficialJobsPageSignal=(html='')=>{try{parseFidelityBoard(html);return true}catch{return false}}
export const hasOfficialJobsFeedSignal=(xml='',options={})=>{try{parseFidelityFeed(xml,options);return true}catch{return false}}
// Preserve actual canonical job.source/company; provider decoration and normal
// persistence already honor these fields. The misspelled registered ID remains.
export const createFedilityInvestmentsScraper=(defaults={})=>{
 const canonical=createFidelityScraper(defaults)
 return {run:(options={})=>runWithFidelityDelegation(canonical,options)}
}
export const run=async(options={})=>createFedilityInvestmentsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}

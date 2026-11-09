import path from 'node:path'
import {fileURLToPath} from 'node:url'
import SIGMA_SOLVE_CATALOG from './catalog.js'
import {createSigmaSolveNativeScraper} from './native20261108.js'
import {listing,own,countryFor,need} from './data20261108.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA=SIGMA_SOLVE_CATALOG
export const SOURCE=PROVIDER_METADATA.source,COMPANY=PROVIDER_METADATA.companyName,CAREERS_PAGE_URL=PROVIDER_METADATA.officialCareersPageUrl,VERIFIED_ON=PROVIDER_METADATA.verifiedOn
export const hasOfficialOpeningsPageSignal=html=>{try{listing(html);return true}catch{return false}}
export const extractOpeningSummaries=html=>listing(html).records.map(value=>({title:value.title,department:value.metadataValues[1]??null,employmentType:value.metadataValues[0]??null,sourceUrl:value.roleURL,applyUrl:value.roleURL,nativeListingRecord:structuredClone(value)}))
export const extractJobsFromDetailPages=(pages=[])=>pages.map(({summary,detailHtml})=>{
 need(summary?.nativeListingRecord,'complete original native listing record required')
 const parsed=own(detailHtml,summary.nativeListingRecord),model=parsed.model,field=key=>model.metadata.find(v=>v.label===key)?.value??null
 return {title:model.title,company:COMPANY,department:field('Department'),location:field('Location'),city:null,state:null,country:countryFor(field('Location')),jobId:null,requisitionId:null,nativeObservationKey:model.roleURL,nativeObservationKeyKind:'publisher-canonical-own-role-URL;not-a-posting-or-requisition-id',sourceUrl:model.roleURL,applyUrl:model.applicationURL,employmentType:field('Type'),experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:model.description,remoteStatus:null,sourceRemoteStatusUnresolved:true,sourceNativeRecord:structuredClone(model),sourceNativeOwnDescriptionHTML:model.descriptionHTML,sourceNativeCurrentPublicationQualified:false,sourceNativeContractQualified:parsed.contractQualified,sourceScopeComplete:false,lifecycleCleanupAllowed:false,activeApplyVerified:false,applicationVisited:false}
})
export const createSigmaSolveScraper=(options={})=>createSigmaSolveNativeScraper(options)
export const run=async(options={})=>createSigmaSolveScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
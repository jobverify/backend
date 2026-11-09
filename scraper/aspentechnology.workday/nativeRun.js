import {createVerifiedRecruitmentScraper} from '../../scraper-support/utils/verifiedRecruitment.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {PROVIDER_METADATA} from './catalog.js'
export function runAspenNativeRecruitment(options={}){
 options.signal?.throwIfAborted()
 if(options.maxJobs===0)return attachInventoryEvidence([],{status:'coverage-gap',surface:PROVIDER_METADATA.companyCareerPage,
  firstParty:true,listingComplete:false,pagesFetched:0,reason:'caller-cap-zero-no-public-reads'})
 return createVerifiedRecruitmentScraper({
  ...PROVIDER_METADATA,officialHomepageUrl:PROVIDER_METADATA.companyCareerPage,publisherNames:['AspenTech','Aspen Technology'],
  nativeEmployerNames:['AspenTech','OSI Energy Automation India Private Limited'],
  nativeWorkdayLegalEmployerNames:['OSI Energy Automation India Private Limited'],
  nativeWorkdayEmployerDeclaration:{name:'AspenTech',kind:'first-paragraph-employment-introduction',
    prefix:'The driving force behind our success has always been the people of AspenTech.'},
  requireCorporateIdentityMatch:true,requireNativeEmployerName:true,prioritizeRecruitmentSearch:true,
  preferIndiaInventory:true,preferPublishedIndiaLocationFacets:true,nativeWorkdaySiteId:'AspenTech',reconcileWorkdayNativeContext:true,nativeRequestIntervalMs:1000,
 }).run({maxDetails:40,maxRequests:128,sourceTimeoutMs:180000,...options})
}

import {createVerifiedRecruitmentScraper} from '../../scraper-support/utils/verifiedRecruitment.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {TELSTRA_CATALOG} from './catalog.js'
export function runTelstraNativeRecruitment(options={}){
 options.signal?.throwIfAborted()
 if(options.maxJobs===0)return attachInventoryEvidence([],{status:'coverage-gap',surface:TELSTRA_CATALOG.companyCareerPage,
  firstParty:true,listingComplete:false,pagesFetched:0,reason:'caller-cap-zero-no-public-reads'})
 return createVerifiedRecruitmentScraper({
  ...TELSTRA_CATALOG,officialHomepageUrl:TELSTRA_CATALOG.companyCareerPage,publisherNames:['Telstra'],
  nativeEmployerNames:['Telstra Telecommunications Private Limited','Telstra Global Business Services LLP.'],
  nativeWorkdayLegalEmployerNames:['Telstra Telecommunications Private Limited','Telstra Global Business Services LLP.'],
  nativeWorkdayEmployerDeclaration:{name:'Telstra',kind:'name-leading-statement',
    prefix:'Telstra is Australia\u2019s leading telecommunications and technology company'},
  requireCorporateIdentityMatch:true,requireNativeEmployerName:true,prioritizeRecruitmentSearch:true,
  preferIndiaInventory:true,reconcileWorkdayNativeContext:true,nativeRequestIntervalMs:1000,
 }).run({maxDetails:40,maxRequests:128,sourceTimeoutMs:180000,...options})
}

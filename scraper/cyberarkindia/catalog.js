import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {CAREERS} from './currentAuthority20261120.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export default {
 source:'cyberarkindia',companyName:'CyberArk India',officialBrandName:'CyberArk',adapter:'script',
 homepageUrl:'https://www.cyberark.com/',companyCareerPage:CAREERS,companyDomain:'cyberark.com',workspaceDomain:'jobs.paloaltonetworks.com',
 atsPlatform:'official-company-careers-handoff-to-shared-parent-jobs',countryFilter:'India',parser:'custom-script',
 authoritativeCurrentPublication:true,backfillMode:'live-parser',scraperTimeoutMs:180000,
 normalizationProfile:'engineering-default',zeroResultPolicy:'evidence-required',
 modulePath:path.resolve(currentDir,'script.js'),dryRunFile:'cyberarkindia/jobs.json',
 paginationStrategy:'bounded-first15-current-literal-native-India-search;every-exact-CyberArk-role-independently-read-twice',
 extractionStrategy:'current-CyberArk-redirect+actual-corporate-Careers-delegation+native-SSR+exact-CyberArk-legal-employer+same-requisition-original-apply',
 verifiedOn:null,verifiedAt:null,verifiedPublicJobCount:null,verifiedGlobalJobCount:null,verifiedIndiaJobCount:null,
 sourceScopeComplete:false,lifecycleCleanupAllowed:false,
 verifiedSurfaceSummary:'Current own CyberArk careers redirect and the actual delegated corporate Careers link are independently retained twice. The shared Palo Alto Networks native publisher is recorded as publisher; only roles whose original hiring organization is exactly CyberArk Software (India) Private Limited qualify for this source. Every native title, requisition, legal employer, explicit India alternative, authored criteria/dates and same-role application must qualify independently. Parent brands and parent legal employers remain held. Valid partials retain all original models and dates. Full company inventory, remaining pagination, application UI/backend activation and cleanup remain unverified.'
}

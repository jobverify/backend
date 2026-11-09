import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export default {
 source:'amberstudent',companyName:'Amberstudent',adapter:'script',modulePath:path.join(currentDir,'script.js'),
 companyCareerPage:'https://amberstudent.com/career',companyDomain:'amberstudent.com',countryFilter:'India',
 officialJobsBoardUrl:'https://amberstudent.keka.com/careers/',atsPlatform:'keka',
 paginationStrategy:'complete-public-keka-active-inventory',
 extractionStrategy:'current-first-party-route+reviewed-native-client+full-keka-models+worksite-country-reconciliation+closing-recheck',
 verifiedOn:'2026-11-05',verifiedPublicJobCount:14,verifiedIndiaJobCount:7,
 verifiedSurfaceSummary:'Current Amber careers and its declared jobs client bind the exact public Keka account. Of 14 full native roles, seven have consistent India worksite evidence, three lack country-bearing locations and four conflict with their own descriptions. Opening and closing account, complete array and current corporate handoffs are paired. Full native criteria and publication precision are preserved. Company inventory scope and lifecycle cleanup remain unqualified.',
 kekaIdentifier:'228f83f5-48b3-474a-b753-4fce2be7524f',
 kekaJobsApiUrl:'https://amberstudent.keka.com/careers/api/embedjobs/default/active/228f83f5-48b3-474a-b753-4fce2be7524f',
}

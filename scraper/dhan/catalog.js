import path from 'node:path'
import {fileURLToPath} from 'node:url'
export const DHAN_CATALOG={source:'dhan',companyName:'Dhan',officialBrandName:'Dhan',adapter:'script',homepageUrl:'https://dhan.co/',companyCareerPage:'https://dhan.co/career/',
 officialCareersHandoffUrl:'https://raise.keka.com/careers',careersApiOrigin:'https://raise.keka.com/careers/api',careersConfigUrl:null,careersFilterParamsUrl:null,
 jobsApiUrl:'https://raise.keka.com/careers/api/embedjobs/default/active/7669ff3a-2b35-4442-9bac-9f9ae4b718b3',companyDomain:'dhan.co',atsPlatform:'keka',countryFilter:'India and unresolved native country observations',
 paginationStrategy:'paired-corporate-declared-native-group-feed;company-scope-unqualified',extractionStrategy:'current-corporate-declared-raise-keka-original-native-models',parser:'custom-script',normalizationProfile:'engineering-default',verifiedOn:null,
 sourceEmployerScope:'corporate-declared-group-board',sourceExactBrandRoleScopeVerified:false,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
 verifiedSurfaceSummary:'Current https://dhan.co/career/ declares https://raise.keka.com/careers. Read its literal public document, literal khConfig, published embed client and three native GET models as data only. Native employer display is Raise holding; observations are group roles, with Dhan-only ownership and company totals unqualified. Preserve full original criteria and explicit native countries, hold NA placeholders, retain missing/conflicting workplaces as unknown, and reconcile closing models and identity. Native IDs are not formal requisitions; publishedOn is not verified first publication. Application activation and cleanup remain unverified.',
 modulePath:path.join(path.dirname(fileURLToPath(import.meta.url)),'script.js')}
export default DHAN_CATALOG

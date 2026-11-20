import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA={
 source:'telioev',companyName:'TelioEV',officialBrandName:'TelioEV',adapter:'script',modulePath:path.resolve(currentDir,'script.js'),
 homepageUrl:'https://telioev.com/',companyCareerPage:'https://telioev.com/job-opening/',officialCareersPageUrl:'https://telioev.com/careers/',companyDomain:'telioev.com',
 atsPlatform:'first-party-current-native-WordPress-job-archive-and-own-application-forms',countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',
 authoritativeCurrentPublication:true,backfillMode:'live-parser',scraperTimeoutMs:180000,verifiedOn:null,verifiedJobCount:null,verifiedIndiaJobCount:null,
 paginationStrategy:'independently-paired-own-current-archive-publication-plus-optional-paired-authored-native-role-details;company-allchannels-unverified',
 extractionStrategy:'current-own-publisher-and-native-role-title-link;whole-role-government-municipal-proof;actual-WordPress-post-and-form-job-ID-binding-when-observed;all-original-criteria-date-variants-as-partials',
 verifiedSurfaceSummary:'Pairs the current own TelioEV homepage, careers handoff and actual native job archive. Whole own workplace labels are matched to retained independent government originals for Pune, Mumbai and Chennai, with all original alternatives preserved. The native own public role URL is an authored public handoff; optional full role pages bind the WordPress main/body post ID and actual form awsm_job_id, title, workplace and declared same-page public intake. Native availability contradictions hold; optional outages retain independently qualified partials and known criteria/dates. Formal requisition and legal employer are not invented; SEO updated timestamps have unasserted posting semantics. Full form controls/backend activation, complete company/all-channel/India-facet totals and lifecycle replacement remain unverified.',
 zeroResultPolicy:'evidence-required',dryRunFile:'telioev/jobs.json'
}
export default PROVIDER_METADATA

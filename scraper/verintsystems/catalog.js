import { fileURLToPath } from 'node:url'

const modulePath = fileURLToPath(new URL('./script.js', import.meta.url))

export const VERINT_SYSTEMS_CATALOG = {
  source: 'verintsystems',
  companyName: 'Verint Systems',
  officialBrandName: 'Verint',
  adapter: 'script',
  catalogOverride: true,
  modulePath,
  homepageUrl: 'https://www.verint.com/careers/',
  companyCareerPage: 'https://www.verint.com/careers/',
  oracleCandidateExperienceUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX',
  workspaceDomain: 'fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com',
  listingApiBaseUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  detailApiBaseUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  publicJobsBaseUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/',
  siteNumber: 'CX',
  atsPlatform: 'ashby',
  boardToken: 'verint',
  nativeBoardUrl: 'https://jobs.ashbyhq.com/27cfd344-670f-4dcd-8b13-0e18005b0d65',
  companyDomain: 'verint.com',
  countryFilter: 'India',
  paginationStrategy: 'paired-current-own-native-board-documented-feed-and-positive-India-role-partials',
  extractionStrategy: 'active-own-Verint-declaration;original-native-board-and-typed-feed-countries;full-same-role-state-schema-criteria-dates-unvisited-application',
  parser: 'custom-script',
  backfillMode: 'live-parser',
  authoritativeCurrentPublication: true,
  scraperTimeoutMs: 180000,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedGlobalJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    'Current active Verint careers anchors declare the native board. Original board state, documented public feed and every selected India role must reconcile exact public identity, publisher, explicit work/applicant countries, publication, authored criteria/dates and same-role unvisited application in two observations. Native posting.locationAddress null remains null; explicit feed/schema countries are separate evidence. Only positive partials may qualify. Full company inventory, global/India/facet totals, formal requisition IDs, legal employing entity, application controls, renderer/backend activation and cleanup remain held. Publisher programmes are parsed as data. November14 documents and Oracle fields are historical compatibility only; no body/build/roster/date/organization-ID pins or default historical fallback.',
}

export default VERINT_SYSTEMS_CATALOG

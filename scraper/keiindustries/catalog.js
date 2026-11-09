import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const VERIFIED_SURFACE_SUMMARY = 'The current official KEI Industries homepage and Life at KEI page advertise the KEIIND CandidateMAX portal and a secondary maxhr CandidateMAX application channel. Validate each advertised frontend and public company configuration before using its anonymous no-token landing, labels and vacancy reads. The public UI pages the complete VacancyInformation response in the browser and renders FUNCTION_DESC, FUNCTION_RESPONSIBILITY and all dynamic ~D fields. Reconcile opening and closing IDs, original publication/expiry metadata, visible criteria, employer identity and advertised channels before output caps. The old WordPress /jobs/ route is now a general-content archive and cannot establish hiring inventory. An unresolved advertised portal keeps whole-company counts unavailable and cleanup disabled.'
export const KEI_INDUSTRIES_CATALOG = {
  source: 'keiindustries',
  companyName: 'KEI Industries',
  officialBrandName: 'KEI Industries',
  adapter: 'script',
  companyCareerPage: 'https://keihrms.myadrenalin.com/CandidateMAX/#/?CompanyID=KEIIND#new_tab',
  homepageUrl: 'https://www.kei-ind.com/',
  officialCareerPageUrl: 'https://www.kei-ind.com/career-at-kei/life-at-kei/',
  jobsArchiveUrl: 'https://www.kei-ind.com/jobs/',
  jobListingsUrl: 'https://keihrms.myadrenalin.com/CandidateMAX/#/?CompanyID=KEIIND#new_tab',
  additionalPublicRecruitmentChannels: ['https://maxhr.myadrenalin.com/CandidateMAX/#/?CompanyID=KEIIND#new_tab'],
  publicCompanyId: 'KEIIND',
  companyDomain: 'kei-ind.com',
  atsPlatform: 'adrenalin-candidatemax',
  countryFilter: 'India',
  paginationStrategy: 'frontend-proven-complete-anonymous-feed+client-pagination+closing-reconciliation',
  extractionStrategy: 'official-employer-handoffs+no-token-native-vacancies+full-visible-criteria+explicit-role-country',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-27',
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  zeroResultPolicy: 'evidence-required',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: path.join(currentDir, 'jobs.json'),
  modulePath: path.join(currentDir, 'script.js'),
}
export default KEI_INDUSTRIES_CATALOG

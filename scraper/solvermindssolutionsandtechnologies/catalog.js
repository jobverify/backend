import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Tuesday, August 4, 2026 that https://www.solverminds.com/ is the live Solverminds homepage, that https://www.solverminds.com/about includes a first-party "See open roles" handoff to the public Zoho Recruit board at https://careers.solverminds.com/jobs/Careers, and that the public jobs API at https://careers.solverminds.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite returns live Solverminds job records. Verified sample public detail pages including Associate Software Engineer and Senior Business Analyst on the careers.solverminds.com domain.'

export const SOLVERMINDS_SOLUTIONS_AND_TECHNOLOGIES_CATALOG = {
  source: 'solvermindssolutionsandtechnologies',
  companyName: 'Solverminds Solutions and Technologies',
  officialBrandName: 'Solverminds Solutions & Technologies Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.solverminds.com/',
  companyCareerPage: 'https://careers.solverminds.com/jobs/Careers',
  aboutPageUrl: 'https://www.solverminds.com/about',
  careersApiUrl: 'https://careers.solverminds.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  companyDomain: 'solverminds.com',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'official-about-page-handoff-plus-public-zoho-api',
  extractionStrategy: 'verified-homepage+verified-about-page-handoff+verified-zohorecruit-portal+public-job-openings-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'solvermindssolutionsandtechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SOLVERMINDS_SOLUTIONS_AND_TECHNOLOGIES_CATALOG

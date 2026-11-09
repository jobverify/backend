import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NEW_VISION_SOFTWARE_CONSULTANCY_CATALOG = {
  source: 'newvisionsoftwareconsultancy',
  companyName: 'NewVision Software & Consultancy',
  officialBrandName: 'New Vision Softcom & Consultancy Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://newvision-software.com/',
  companyCareerPage: 'https://newvision-software.com/careers/',
  portalOrigin: 'https://careers-newvision.peoplestrong.com',
  jobListingsUrl: 'https://careers-newvision.peoplestrong.com/',
  jobsApiUrl: 'https://careers-newvision.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  companyDomain: 'careers-newvision.peoplestrong.com',
  atsPlatform: 'peoplestrong',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-peoplestrong-offset-limit-api',
  extractionStrategy: 'official-careers-page+direct-peoplestrong-handoff+peoplestrong-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 97,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://newvision-software.com/careers/ remained the official NewVision Software & Consultancy careers page, exposed a See Open Roles handoff to https://careers-newvision.peoplestrong.com/, and that the public PeopleStrong jobs API at https://careers-newvision.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20 returned 97 public openings including Sr. Python Developer AI/ML, AI Engineer, and Architect.',
  dryRunFile: 'newvisionsoftwareconsultancy/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NEW_VISION_SOFTWARE_CONSULTANCY_CATALOG

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ALPHA_DESIGN_TECHNOLOGIES_CATALOG = {
  source: 'alphadesigntechnologies',
  companyName: 'Alpha Design Technologies',
  officialBrandName: 'Alpha Design Technologies Pvt Ltd',
  adapter: 'script',
  companyCareerPage: 'https://www.adtl.co.in/careers',
  homepageUrl: 'https://www.adtl.co.in/',
  applicationEmail: 'careers@adtl.co.in',
  applicationUrl: 'mailto:careers@adtl.co.in',
  companyDomain: 'adtl.co.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-resume-only-careers-page-plus-common-route-404-validation',
  extractionStrategy: 'verified-homepage+verified-resume-only-careers-page+verified-missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.adtl.co.in/ is the live first-party Alpha Design Technologies Pvt Ltd homepage, that https://www.adtl.co.in/careers is the linked first-party resume-only careers page, and that the careers page currently instructs applicants to submit resumes to careers@adtl.co.in without publishing any trustworthy public job listings. Common first-party job routes such as https://www.adtl.co.in/career, https://www.adtl.co.in/jobs, https://www.adtl.co.in/join-us, https://www.adtl.co.in/openings, and https://www.adtl.co.in/work-with-us all returned first-party 404 pages. There is no trustworthy public jobs surface for Alpha Design Technologies on the official first-party domain.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ALPHA_DESIGN_TECHNOLOGIES_CATALOG

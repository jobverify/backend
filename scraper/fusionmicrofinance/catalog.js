import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FUSION_MICROFINANCE_CATALOG = {
  source: 'fusionmicrofinance',
  companyName: 'Fusion Microfinance',
  officialBrandName: 'Fusion Finance',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'fusionmicrofinance/jobs.json',
  homepageUrl: 'https://fusionfin.com/',
  companyCareerPage: 'https://fusionfin.com/careers/',
  genericApplicationUrl: 'https://fusionfin.com/careers/',
  recruiterEmail: 'recruiter@fusionfin.com',
  verifiedGenericJobTitles: [
    'MFI - Relationship Officer',
    'MFI - Audit Officer',
    'MFI - Branch Manager',
    'MFI - Area Manager',
    'MSME - Business Development Officer',
    'MSME - Credit Officer',
    'MSME - Executive Operations',
  ],
  verifiedFeaturedRoleUrls: [
    'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/',
  ],
  verifiedFeaturedRoleDetailExampleUrl: 'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/',
  companyDomain: 'fusionfin.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-same-domain-detail-pages',
  extractionStrategy:
    'verified-homepage+verified-careers-page+inline-generic-job-form+same-domain-detail-pages+inline-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on August 4, 2026 that https://fusionfin.com/ is the live first-party Fusion Finance Limited homepage for the backlog company Fusion Microfinance, that both Careers and Current Openings on the official site point to https://fusionfin.com/careers/, and that the homepage footer legal copy still says Fusion Finance Limited (Formerly known as Fusion Micro Finance Limited). Verified that https://fusionfin.com/careers/ exposes a public Current Openings section, a first-party application form with the Job Title options MFI - Relationship Officer, MFI - Audit Officer, MFI - Branch Manager, MFI - Area Manager, MSME - Business Development Officer, MSME - Credit Officer, and MSME - Executive Operations, and a visible same-domain detail role at https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/. Verified that the QA detail page exposes Experience 1-5, State Haryana, City Gurgaon/Gurugram, Job Role Automation Testing, recruiter@fusionfin.com, and an inline first-party application form.',
}

export default FUSION_MICROFINANCE_CATALOG

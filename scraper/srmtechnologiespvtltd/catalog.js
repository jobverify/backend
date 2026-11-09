import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Wednesday, August 5, 2026 that https://www.srmtech.com/ is the live first-party SRM Technologies homepage, that its Careers With Us section now links Open Positions directly to the branded public Zoho Recruit board at https://careers.srmtech.com/jobs/Careers, and that the paired public jobs API at https://careers.srmtech.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite is live with current India openings including IT Infrastructure (L2/Subject matter Expert) in Chennai, Linux Embedded Computer Vision Developer in Perungudi, and Cognos Senior Architect in Hyderabad. The legacy candidate portal route at https://careers.srmtech.com/candidateportal is still referenced by the Zoho board metadata, but public jobs are now enumerable from the live board and API.'

export const SRM_TECHNOLOGIES_PVT_LTD_CATALOG = {
  source: 'srmtechnologiespvtltd',
  companyName: 'SRM Technologies Pvt.Ltd',
  officialBrandName: 'SRM Technologies',
  adapter: 'script',
  homepageUrl: 'https://www.srmtech.com/',
  companyCareerPage: 'https://www.srmtech.com/',
  careersPortalUrl: 'https://careers.srmtech.com/jobs/Careers',
  careersApiUrl: 'https://careers.srmtech.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  candidatePortalUrl: 'https://careers.srmtech.com/candidateportal',
  companyDomain: 'srmtech.com',
  atsPlatform: 'zoho-recruit',
  countryFilter: 'India',
  paginationStrategy: 'homepage-handoff-plus-single-zoho-public-api-request',
  extractionStrategy:
    'verified-homepage-open-positions-handoff+verified-zoho-board+public-job-openings-api+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedPublicPostingCount: 20,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'srmtechnologiespvtltd/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SRM_TECHNOLOGIES_PVT_LTD_CATALOG

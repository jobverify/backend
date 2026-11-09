import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.apexon.com/ is the live Apexon homepage, that https://www.apexon.com/about/careers/ is the first-party careers page and links job seekers to the first-party jobs hub at https://www.apexon.com/explore-jobs/, and that the jobs hub currently exposes 31 India job rows linking to first-party detail pages such as https://www.apexon.com/career-job-detail/?id=0&jobid=6500. Verified detail pages expose structured first-party job content plus outbound TalentRecruit apply links such as apexon.talentrecruit.com career-page apply URLs.'

export const APEXON_CATALOG = {
  source: 'apexon',
  companyName: 'Apexon',
  officialBrandName: 'Apexon',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'apexon/jobs.json',
  companyCareerPage: 'https://www.apexon.com/about/careers/',
  homepageUrl: 'https://www.apexon.com/',
  exploreJobsUrl: 'https://www.apexon.com/explore-jobs/',
  sampleDetailUrl: 'https://www.apexon.com/career-job-detail/?id=0&jobid=6500',
  companyDomain: 'apexon.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-handoff-plus-single-first-party-explore-jobs-listing',
  extractionStrategy:
    'verified-homepage+verified-careers-page+first-party-explore-jobs-table+first-party-detail-pages+talentrecruit-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default APEXON_CATALOG

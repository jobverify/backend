import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INTERACTIVE_AVENUES_CATALOG = {
  source: 'interactiveavenues',
  companyName: 'Interactive Avenues',
  officialBrandName: 'Interactive Avenues',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.interactiveavenues.com/',
  officialCareersLandingUrl: 'https://www.interactiveavenues.com/join-us/index.html',
  officialJobsHubUrl: 'https://careers.ipgmediabrands.com/postings/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India',
  greenhouseJobsBaseUrl: 'https://careers.ipgmediabrands.com/posting-greenhouse/',
  companyCareerPage: 'https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India',
  greenhouseBoardEmbedUrl: 'https://boards.greenhouse.io/embed/job_board/js?for=mediabrands',
  atsPlatform: 'greenhouse-first-party-filtered-job-board',
  countryFilter: 'India',
  paginationStrategy: 'official-first-party-jobs-hub-plus-filtered-greenhouse-listing-plus-public-detail-pages',
  extractionStrategy:
    'verified-first-party-careers-handoff+first-party-jobs-hub+first-party-filtered-greenhouse-job-rows+greenhouse-embedded-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'interactiveavenues.com',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that the official Interactive Avenues careers landing page at https://www.interactiveavenues.com/join-us/index.html still hands off to the first-party Mediabrands jobs hub at https://careers.ipgmediabrands.com/postings/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India, that the hub now routes All other Locations traffic to https://careers.ipgmediabrands.com/posting-greenhouse/, and that the verified filtered first-party board at https://careers.ipgmediabrands.com/posting-greenhouse/?gh_search=&department=Interactive+Avenues+-+India&interest=&location=India exposed 1 public India job: Media: Associate Vice President/Vice President in Bangalore, Bangalore, India with first-party detail route job_id=5105985007 and Greenhouse embed handoff https://boards.greenhouse.io/embed/job_board/js?for=mediabrands.',
  dryRunFile: 'interactiveavenues/jobs.json',
}

export default INTERACTIVE_AVENUES_CATALOG

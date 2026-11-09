import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const TRICON_INFOTECH_CATALOG = {
  source: 'triconinfotech',
  companyName: 'Tricon Infotech',
  officialBrandName: 'Tricon Infotech',
  adapter: 'script',
  homepageUrl: 'https://www.triconinfotech.com/',
  companyCareerPage: 'https://www.triconinfotech.com/tricon-careers/',
  jobsApiUrl: 'https://www.triconinfotech.com/wp-json/wp/v2/awsm_job_openings?_fields=id,date_gmt,modified_gmt,link,title,content,class_list,status,type&per_page=100&page=1&orderby=id&order=asc',
  companyDomain: 'triconinfotech.com',
  atsPlatform: 'awsm-jobs',
  countryFilter: 'India',
  paginationStrategy: 'wordpress-count-headers-and-all-pages',
  extractionStrategy: 'official-jobs-handoff+published-feed+all-details+stable-inventory+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedSurfaceSummary: 'Verified on October 9, 2026: the official Tricon careers page links its first-party /jobs/ archive. The published AWSM REST feed reports one role across one page; full detail and application ID 312962 agree on DevOps Engineer (Azure DevOps) – Portland. Complete global inventory is one and current India inventory is zero; paging/count, publication, descriptions, locations and form identities are reconciled before country filtering.',
  dryRunFile: 'triconinfotech/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}
export default TRICON_INFOTECH_CATALOG

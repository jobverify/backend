import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG = {
  source: 'nxtgendatacentercloudtechnologies',
  companyName: 'Nxtgen Datacenter Cloud Technologies',
  officialBrandName: 'NxtGen Datacenter & Cloud Technologies',
  adapter: 'script',
  homepageUrl: 'https://nxtgen.co.in/',
  companyCareerPage: 'https://nxtgen.co.in/careers',
  companyDomain: 'nxtgen.co.in',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-static-featured-jobs-page',
  extractionStrategy:
    'verified-first-party-careers-page+visible-featured-job-cards+same-page-apply-modals+pdf-detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that direct probes to https://nxtgen.co.in/ and https://nxtgen.co.in/careers timed out from this environment instead of returning a reachable first-party jobs surface. The last known trustworthy NxtGen careers contract remains the same Featured Jobs page with same-page apply modals and downloadable PDF detail assets that previously listed Customer Life Cycle Manager, Customer Relationship Manager, Network Architect, and Priority Support Consultant - Compute in Bengaluru, so the scraper now returns an empty verified sentinel result when the host stays timed out.',
  dryRunFile: 'nxtgendatacentercloudtechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG
